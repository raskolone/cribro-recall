import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { HOMEWORK_ENGINE_V2 } from '../config/featureFlags';
import type { ExerciseContractV2, MasteryState } from './homeworkV2/contracts';

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
  const call = httpsCallable<GenerateSetRequest, GenerateSetResponse>(functions, 'generateHomeworkV2', {
    timeout: 540_000,
  });
  const result = await call(request);
  return result.data;
};

/** Zapisuje zestaw i przypisuje go kursantom. */
export const assignHomeworkSetV2 = async (request: AssignSetRequest): Promise<AssignSetResponse> => {
  assertEnabled();
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
