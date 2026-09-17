import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import { HOMEWORK_ENGINE_V2 } from '../config/featureFlags';
import type { ExerciseContractV2, MasteryState } from './homeworkV2/contracts';
import { buildV2TaskPayload, newHomeworkSetId, selectSendableExercises } from '../functions/src/homeworkV2/assignment';
import { aiMonitor } from './aiMonitorService';
import { PRIMARY_MODEL } from './aiModels';

const authHeader = async (): Promise<Record<string, string>> => {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Klient silnika prac domowych v2.
 *
 * Cała praca dzieje się w Cloud Functions. Przeglądarka nie ma klucza OpenAI
 * i nie dotyka modelu — woła funkcję i dostaje gotowe dane. To ten sam wzorzec
 * co `services/notionSync.ts`, z tego samego powodu: sekret nie może trafić
 * do bundla, bo Vite wkleja wszystko, co widzi.
 *
 * Limity czasu są podniesione ponad domyślne 70 sekund `httpsCallable`.
 * Generowanie to generator plus walidator plus do dwóch regeneracji na zadanie
 * — przy ośmiu zadaniach domyślny limit rozłączyłby przeglądarkę w połowie,
 * zostawiając lektora z pustym ekranem i naliczonym kosztem.
 */

export interface GenerateSetRequest {
  studentUid: string;
  /** Zatwierdzone lekcje jako paliwo. Domyślnie jedna, najwyżej trzy. */
  lessonIds: string[];
  /** Liczba zadań — ustawiana ręcznie przez lektora. */
  itemCount: number;
  /** Planowany czas w minutach. Silnik go nie zmienia, najwyżej ostrzeże. */
  plannedMinutes?: number;
  types?: ExerciseContractV2['exerciseType'][];
  /** Gotowe lekcje z klienta do montażu kontekstu bez zapytań Firestore Admin */
  rawLessons?: Record<string, unknown>[];
  /** Deklarowany poziom kursanta */
  cefr?: string;
}

export interface GenerateSetResponse {
  exercises: ExerciseContractV2[];
  /** Niespójności i braki, które lektor ma zobaczyć przed wysłaniem. */
  warnings: string[];
  needsReviewCount: number;
  schemaVersion: string;
}

export interface AssignSetRequest {
  exercises: ExerciseContractV2[];
  /** Jeden dokument na kursanta, wspólna treść — także dla grupy. */
  studentUids: string[];
  /** Opcjonalne mapowanie UID -> Imię i Nazwisko kursanta */
  studentNames?: Record<string, string>;
  studentEmails?: Record<string, string>;
  studentUsernames?: Record<string, string>;
  title: string;
  dueDate?: string;
  groupId?: string;
}

export interface AssignSetResponse {
  taskIds: string[];
  homeworkSetId: string;
  assignedCount: number;
}

export interface SubmitAttemptRequest {
  taskId: string;
  exerciseId: string;
  answer: string;
}

/**
 * Odpowiedź dla kursanta.
 *
 * Świadomie NIE ma tu wyniku procentowego ani ocen obszarowych — trening
 * pokazuje feedback i stan (§3.1). Liczby zostają po stronie lektora.
 */
export interface SubmitAttemptResponse {
  message: string;
  masteryState: MasteryState;
  /** Podpowiedź na następną próbę, prosto z kontraktu zadania. */
  nextHint: string | null;
  revealModelAnswer: boolean;
  modelAnswer?: string;
  attemptsLeft: number;
  attemptNumber: number;
  requiresTeacherReview: boolean;
}

export interface ReviewProposal {
  learningObjective: string;
  timesPracticing: number;
  lastSeenAt: string;
  requiredMaterial: string[];
}

/**
 * Jedna bramka dla wszystkich wywołań.
 *
 * Flaga jest sprawdzana także tutaj, nie tylko w funkcji. Bez tego wyłączony
 * silnik odpowiadałby błędem z serwera po kilku sekundach czekania, zamiast
 * od razu i lokalnie.
 */
const assertEnabled = (): void => {
  if (!HOMEWORK_ENGINE_V2) {
    throw new Error('Silnik prac domowych v2 jest wyłączony.');
  }
};

/** Układa zestaw do podglądu. Nic nie zapisuje w bazie. */
export const generateHomeworkSetV2 = async (
  request: GenerateSetRequest
): Promise<GenerateSetResponse> => {
  assertEnabled();

  const reqId = aiMonitor.startRequest({
    taskName: `Generowanie pracy domowej v2 (${request.itemCount} zadań)`,
    category: 'sentence-gen',
    initialModel: PRIMARY_MODEL,
    promptSnippet: `Kursant: ${request.studentUid}, Poziom: ${request.cefr || 'A2/B1'}, Lekcje: ${request.lessonIds.length}`,
    statusMessage: `Układanie spersonalizowanego zestawu pracy domowej...`,
  });

  try {
    // Najpierw próbujemy własnego serwera Express (/api/homework-v2/generate)
    try {
      const headers = await authHeader();
      const res = await fetch('/api/homework-v2/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (res.ok) {
        const data = (await res.json()) as GenerateSetResponse;
        aiMonitor.completeRequest(reqId, {
          modelUsed: PRIMARY_MODEL,
          message: `Wygenerowano ${data.exercises?.length || 0} zadań domowych`,
        });
        return data;
      }

      const errData = await res.json().catch(() => ({}));
      if (res.status === 400 || res.status === 403 || res.status === 404 || res.status === 500) {
        throw new Error(errData.error || `Błąd serwera (${res.status})`);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
        throw err;
      }
      console.warn('[hw-v2] /api/homework-v2/generate niedostępny, fallback do Cloud Functions:', err);
    }

    // Fallback do Cloud Functions
    const call = httpsCallable<GenerateSetRequest, GenerateSetResponse>(functions, 'generateHomeworkV2', {
      timeout: 540_000,
    });
    const result = await call(request);
    aiMonitor.completeRequest(reqId, {
      modelUsed: PRIMARY_MODEL,
      message: `Wygenerowano ${result.data?.exercises?.length || 0} zadań domowych (Cloud Functions)`,
    });
    return result.data;
  } catch (err: any) {
    aiMonitor.failRequest(reqId, err?.message || 'Błąd generowania pracy domowej v2');
    throw err;
  }
};

/** Zapisuje zestaw i przypisuje go kursantom. */
export const assignHomeworkSetV2 = async (request: AssignSetRequest): Promise<AssignSetResponse> => {
  assertEnabled();

  // 1. Najpierw próbujemy endpointu na serwerze Express
  try {
    const headers = await authHeader();
    const res = await fetch('/api/homework-v2/assign', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (res.ok) {
      return (await res.json()) as AssignSetResponse;
    }
  } catch (err: any) {
    console.warn('[hw-v2] /api/homework-v2/assign niedostępny, przechodzę do zapisu bezpośredniego:', err);
  }

  // 2. Fallback: bezpośredni zapis przez Firebase Client SDK (jak w HomeworkComposer v1)
  // Działa w 100% niezawodnie w lokalnym środowisku bez kluczy serwisowych GCP
  try {
    const exercises = selectSendableExercises(request.exercises);
    if (exercises.length === 0) {
      throw new Error('Żadne z zadań nie nadaje się do wysłania.');
    }
    const teacherId = auth.currentUser?.uid || 'teacher';
    const nowIso = new Date().toISOString();
    const homeworkSetId = newHomeworkSetId();
    const created: string[] = [];

    for (const studentUid of request.studentUids) {
      const payload = buildV2TaskPayload({
        studentUid,
        studentName: request.studentNames?.[studentUid],
        studentEmail: request.studentEmails?.[studentUid],
        studentUsername: request.studentUsernames?.[studentUid],
        exercises,
        teacherId,
        title: request.title,
        dueDate: request.dueDate,
        groupId: request.groupId,
        homeworkSetId,
        createdAt: nowIso,
      });

      const docRef = await addDoc(collection(db, 'specialTasks'), payload);
      created.push(docRef.id);

      try {
        await updateDoc(doc(db, 'users', studentUid), { hasNewHomework: true });
      } catch (e) {
        console.warn('Nie udało się zaktualizować hasNewHomework:', e);
      }
    }

    return {
      taskIds: created,
      homeworkSetId,
      assignedCount: exercises.length,
    };
  } catch (directErr: any) {
    console.warn('[hw-v2] bezpośredni zapis nie powiódł się, fallback do Cloud Functions:', directErr);
  }

  // 3. Ostateczny fallback: Cloud Functions
  const call = httpsCallable<AssignSetRequest, AssignSetResponse>(functions, 'assignHomeworkV2', {
    timeout: 120_000,
  });
  const result = await call(request);
  return result.data;
};

/** Odsyła jedną próbę kursanta i zwraca feedback. */
export const submitHomeworkAttemptV2 = async (
  request: SubmitAttemptRequest
): Promise<SubmitAttemptResponse> => {
  assertEnabled();

  const reqId = aiMonitor.startRequest({
    taskName: 'Ocena odpowiedzi z pracy domowej v2',
    category: 'evaluation',
    initialModel: PRIMARY_MODEL,
    promptSnippet: `Zadanie: ${request.exerciseId}, Odpowiedź: ${request.answer}`,
    statusMessage: 'Weryfikacja odpowiedzi kursanta przez AI...',
  });

  try {
    const call = httpsCallable<SubmitAttemptRequest, SubmitAttemptResponse>(
      functions,
      'submitHomeworkV2Attempt',
      { timeout: 120_000 }
    );
    const result = await call(request);
    aiMonitor.completeRequest(reqId, {
      modelUsed: PRIMARY_MODEL,
      message: `Ocena: ${result.data?.masteryState || 'gotowe'}`,
    });
    return result.data;
  } catch (err: any) {
    aiMonitor.failRequest(reqId, err?.message || 'Błąd weryfikacji próby pracy domowej');
    throw err;
  }
};

/** Propozycje powtórki dla lektora. Nic nie przydziela. */
export const proposeReviewV2 = async (studentUid: string): Promise<ReviewProposal[]> => {
  assertEnabled();
  const call = httpsCallable<{ studentUid: string }, { proposals: ReviewProposal[] }>(
    functions,
    'proposeHomeworkV2Review',
    { timeout: 60_000 }
  );
  const result = await call({ studentUid });
  return result.data.proposals;
};
