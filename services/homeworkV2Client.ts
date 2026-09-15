import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';
import { HOMEWORK_ENGINE_V2 } from '../config/featureFlags';
import type { ExerciseContractV2, MasteryState } from './homeworkV2/contracts';

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

  // Najpierw próbujemy własnego serwera Express (/api/homework-v2/generate)
  try {
    const headers = await authHeader();
    const res = await fetch('/api/homework-v2/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (res.ok) {
      return (await res.json()) as GenerateSetResponse;
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
  return result.data;
};

/** Zapisuje zestaw i przypisuje go kursantom. */
export const assignHomeworkSetV2 = async (request: AssignSetRequest): Promise<AssignSetResponse> => {
  assertEnabled();

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

    const errData = await res.json().catch(() => ({}));
    if (res.status === 400 || res.status === 403 || res.status === 404 || res.status === 500) {
      throw new Error(errData.error || `Błąd serwera (${res.status})`);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
      throw err;
    }
    console.warn('[hw-v2] /api/homework-v2/assign niedostępny, fallback do Cloud Functions:', err);
  }

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
  const call = httpsCallable<SubmitAttemptRequest, SubmitAttemptResponse>(
    functions,
    'submitHomeworkV2Attempt',
    { timeout: 120_000 }
  );
  const result = await call(request);
  return result.data;
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
