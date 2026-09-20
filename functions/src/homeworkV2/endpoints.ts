/**
 * Endpointy `onCall` silnika v2.
 *
 * Cała warstwa AI stoi tutaj, po stronie Cloud Functions. Frontend nie ma
 * klucza i nie dotyka OpenAI — woła funkcję i dostaje dane.
 *
 * `server.ts` nie jest przepisywany ani wołany. Ścieżki v1 (`/api/openai`,
 * `/api/gemini/*`) działają dalej bez zmian.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

import { FUNCTION_REGION } from '../config';
import { assembleContext } from './contextAssembler';
import {
  AttemptNumber,
  ENGINE_VERSION,
  ExerciseContractV2,
  GradingVerdictV2,
  MAX_ATTEMPTS,
  MasteryState,
  SCHEMA_VERSION,
  hintForAttempt,
  isExerciseContractV2,
  shouldAutoApprove,
} from './contracts';
import { composeFeedback } from './feedbackComposer';
import { gradeAttempt } from './gradingEngine';
import { getRecentMistakes, proposeReview, recordAttemptInProfile } from './learningProfile';
import { createAiCall, createOpenAiCall } from './openai';
import { buildExerciseSet, planExercises } from './pipeline';
import { ENGINE_DISABLED_MESSAGE, isHomeworkEngineV2Enabled } from './flag';
import { getDb } from './db';
import { getHomeworkAiSettings } from './settings';
import { buildV2TaskPayload, newHomeworkSetId, selectSendableExercises } from './assignment';

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const getSecretValue = (secret: ReturnType<typeof defineSecret>): string => {
  try {
    return secret.value() || '';
  } catch {
    return '';
  }
};

// ---------------------------------------------------------------------------
// Bramki
// ---------------------------------------------------------------------------

/**
 * Bramka flagi dla każdego `onCall` silnika v2.
 *
 * Odmowa jest jawna i nazwana. Cicha odpowiedź „brak zadań" przy wyłączonej
 * fladze byłaby gorsza od błędu: wyglądałaby jak awaria generatora.
 */
const requireHomeworkEngineV2 = (): void => {
  if (!isHomeworkEngineV2Enabled()) {
    throw new HttpsError('failed-precondition', ENGINE_DISABLED_MESSAGE);
  }
};

/** Rola czytana z bazy, nigdy z żądania. Ten sam wzorzec co `requireTeacher` w index.ts. */
const requireTeacherUid = async (uid?: string): Promise<string> => {
  if (!uid) throw new HttpsError('unauthenticated', 'Wymagane zalogowanie.');
  const profile = await getDb().collection('users').doc(uid).get();
  const role = profile.data()?.role;
  if (role !== 'admin' && role !== 'teacher' && role !== 'admin_student') {
    throw new HttpsError('permission-denied', 'Tylko lektor może układać prace domowe.');
  }
  return uid;
};

const requireStudentUid = (uid?: string): string => {
  if (!uid) throw new HttpsError('unauthenticated', 'Wymagane zalogowanie.');
  return uid;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];

// ---------------------------------------------------------------------------
// 1. Generowanie podglądu
// ---------------------------------------------------------------------------

/**
 * Układa zestaw i zwraca go do podglądu. **Nic nie zapisuje.**
 *
 * Rozdzielenie generowania od przypisania jest tym, co daje lektorowi
 * 1 ekran podglądu z przyciskiem Wyślij: zadania istnieją w przeglądarce,
 * a w bazie pojawiają się dopiero po jego decyzji.
 */
export const generateHomeworkV2 = onCall(
  {
    region: FUNCTION_REGION,
    secrets: [GEMINI_API_KEY, OPENAI_API_KEY],
    // Generator + walidator + do dwóch regeneracji na zadanie. Limit 60 s
    // z Vercela by tu nie wystarczył — to jeden z powodów, dla których
    // silnik stoi w Functions, a nie w Expressie.
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    requireHomeworkEngineV2();
    const teacherId = await requireTeacherUid(request.auth?.uid);

    const studentUid = String(request.data?.studentUid || '').trim();
    if (!studentUid) throw new HttpsError('invalid-argument', 'Nie wskazano kursanta.');

    const lessonIds = asStringArray(request.data?.lessonIds);
    if (lessonIds.length === 0) throw new HttpsError('invalid-argument', 'Nie wskazano lekcji.');

    const itemCount = Number(request.data?.itemCount) || 6;
    const plannedMinutes = Number(request.data?.plannedMinutes) || 0;
    const requestedTypes = asStringArray(request.data?.types) as ExerciseContractV2['exerciseType'][];

    const studentSnap = await getDb().collection('users').doc(studentUid).get();
    if (!studentSnap.exists) throw new HttpsError('not-found', 'Kursant nie istnieje.');
    const cefr = String(studentSnap.data()?.level || 'B1');

    try {
      const context = await assembleContext({
        studentUid,
        lessonIds,
        cefr,
        recentMistakes: await getRecentMistakes(studentUid),
      });

      const plan = planExercises({ context, requestedTypes, itemCount, plannedMinutes });

      const aiCall = createAiCall({
        geminiApiKey: getSecretValue(GEMINI_API_KEY),
        openAiApiKey: getSecretValue(OPENAI_API_KEY),
      });

      const result = await buildExerciseSet({
        context,
        plan,
        call: aiCall,
        teacherId,
        studentId: studentUid,
      });

      logger.info('[hw-v2] wygenerowano zestaw', {
        teacherId,
        studentUid,
        count: result.exercises.length,
        needsReview: result.needsReviewCount,
        model: result.modelUsed,
      });

      return {
        exercises: result.exercises,
        warnings: result.warnings,
        needsReviewCount: result.needsReviewCount,
        schemaVersion: SCHEMA_VERSION,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[hw-v2] generowanie nie powiodło się', { teacherId, studentUid, error: message });
      throw new HttpsError('internal', message);
    }
  }
);

// ---------------------------------------------------------------------------
// 2. Przypisanie
// ---------------------------------------------------------------------------

/**
 * Zapisuje zestaw jako dokumenty `specialTasks`.
 *
 * Kontrakt zgodności z v1 jest tu dotrzymany co do pola (patrz
 * `docs/audyt-homework-v2.md` §4):
 *   - ćwiczenia lądują w `sentences`, bo `notifyStudentOnHomework` liczy
 *     `sentences.length` jako liczbę zadań w mailu,
 *   - `skipAutoEmail` i `manualEmailConfirmationRequired` wprowadzają v2
 *     w ten sam tryb co oba kreatory v1 — pocztę wysyła lektor z okna
 *     potwierdzenia, a automat wychodzi wcześnie,
 *   - `studentUid` jest wymagany przez regułę `create` w `firestore.rules`.
 *
 * Grupa dostaje JEDEN dokument na kursanta ze wspólnym `homeworkSetId`:
 * identyczna treść, osobne próby, ocena, feedback i profil.
 */
export const assignHomeworkV2 = onCall(
  { region: FUNCTION_REGION, timeoutSeconds: 120, memory: '256MiB' },
  async (request) => {
    requireHomeworkEngineV2();
    const teacherId = await requireTeacherUid(request.auth?.uid);

    const rawExercises = Array.isArray(request.data?.exercises) ? request.data.exercises : [];
    const studentUids = asStringArray(request.data?.studentUids);
    const title = String(request.data?.title || 'Praca domowa').trim();
    const dueDate = String(request.data?.dueDate || '').trim();
    const groupId = String(request.data?.groupId || '').trim();

    if (studentUids.length === 0) throw new HttpsError('invalid-argument', 'Nie wskazano kursantów.');

    const exercises = selectSendableExercises(rawExercises);

    if (exercises.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Żadne z zadań nie nadaje się do wysłania. Popraw lub zregeneruj te oznaczone do przeglądu.'
      );
    }

    const nowIso = new Date().toISOString();
    const homeworkSetId = newHomeworkSetId();

    const created: string[] = [];

    for (const studentUid of studentUids) {
      const payload = buildV2TaskPayload({
        studentUid,
        exercises,
        teacherId,
        title,
        dueDate,
        groupId,
        homeworkSetId,
        createdAt: nowIso,
      });

      const ref = await getDb().collection('specialTasks').add(payload);
      created.push(ref.id);

      try {
        await getDb().collection('users').doc(studentUid).update({ hasNewHomework: true });
      } catch {
        // Flaga to powiadomienie, nie przypisanie. Jej brak nie cofa zadania.
      }
    }

    logger.info('[hw-v2] przypisano zestaw', {
      teacherId,
      homeworkSetId,
      students: studentUids.length,
      exercises: exercises.length,
    });

    return { taskIds: created, homeworkSetId, assignedCount: exercises.length };
  }
);

// ---------------------------------------------------------------------------
// 3. Próba kursanta
// ---------------------------------------------------------------------------

/**
 * Przyjmuje odpowiedź, ocenia ją i zwraca feedback.
 *
 * Werdykt powstaje wyłącznie tutaj i zapisuje go Admin SDK. Kursant nie ma
 * jak podstawić sobie stanu `opanowane` — jego zapis ogranicza się do treści
 * odpowiedzi, a reguły na podkolekcji `attempts` nie przepuszczają pól oceny.
 */
export const submitHomeworkV2Attempt = onCall(
  {
    region: FUNCTION_REGION,
    secrets: [GEMINI_API_KEY, OPENAI_API_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    requireHomeworkEngineV2();
    const studentUid = requireStudentUid(request.auth?.uid);

    const taskId = String(request.data?.taskId || '').trim();
    const exerciseId = String(request.data?.exerciseId || '').trim();
    const answer = String(request.data?.answer || '').trim();

    if (!taskId || !exerciseId) throw new HttpsError('invalid-argument', 'Brak zadania lub ćwiczenia.');
    if (!answer) throw new HttpsError('invalid-argument', 'Odpowiedź jest pusta.');

    const taskSnap = await getDb().collection('specialTasks').doc(taskId).get();
    if (!taskSnap.exists) throw new HttpsError('not-found', 'Zadanie nie istnieje.');

    const task = taskSnap.data() as Record<string, unknown>;
    if (task.studentUid !== studentUid) {
      throw new HttpsError('permission-denied', 'To nie jest Twoje zadanie.');
    }
    if (task.engineVersion !== ENGINE_VERSION) {
      throw new HttpsError('failed-precondition', 'To zadanie nie należy do silnika v2.');
    }

    const exercises = Array.isArray(task.sentences) ? task.sentences : [];
    const contract = exercises.find(
      (item: unknown) => (item as ExerciseContractV2)?.id === exerciseId
    ) as ExerciseContractV2 | undefined;

    if (!contract) throw new HttpsError('not-found', 'Ćwiczenie nie należy do tego zadania.');

    // --- ile prób już było ---------------------------------------------------
    const attemptsRef = getDb().collection('specialTasks').doc(taskId).collection('attempts');
    const previous = await attemptsRef.where('exerciseId', '==', exerciseId).get();

    const attemptNumber = (previous.size + 1) as AttemptNumber;
    if (attemptNumber > MAX_ATTEMPTS) {
      // Czwarta próba to poprawiona wersja po wzorcu — dozwolona raz.
      const alreadyCorrected = previous.docs.some((d) => d.data().isCorrectionAfterModelAnswer === true);
      if (alreadyCorrected) {
        throw new HttpsError('failed-precondition', 'To ćwiczenie jest już zamknięte.');
      }
    }

    const isCorrectionAfterModelAnswer = attemptNumber > MAX_ATTEMPTS;
    const effectiveAttempt = Math.min(attemptNumber, MAX_ATTEMPTS) as AttemptNumber;

    // Stan sprzed tej próby bierzemy z NAJWYŻSZEGO numeru próby, a nie
    // z ostatniego dokumentu w wyniku zapytania: zapytanie bez `orderBy`
    // nie gwarantuje kolejności, więc `.pop()` potrafiłby zwrócić stan
    // sprzed dwóch prób i cofnąć kursantowi postęp.
    const previousState: MasteryState =
      previous.docs
        .map((d) => d.data())
        .filter((d) => typeof d.masteryState === 'string')
        .sort((a, b) => (a.attemptNumber || 0) - (b.attemptNumber || 0))
        .pop()?.masteryState || 'nowe';

    const baseAttemptFields = {
      exerciseId,
      studentUid,
      attemptNumber: effectiveAttempt,
      answer,
      isCorrectionAfterModelAnswer,
      submittedAt: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    };

    /* Human-in-the-loop: silnik oceny wywołuje się sam wyłącznie gdy lektor
       jawnie włączył „Automatyczną ocenę AI przy 100% pewności" (domyślnie
       wyłączone) — i nawet wtedy próba trafia do kursanta natychmiast tylko
       gdy `confidence === 1`. W każdym innym przypadku ocenę uruchamia
       dopiero `proposeHomeworkV2Grade` na życzenie lektora. */
    const { autoApproveAtFullConfidence } = await getHomeworkAiSettings();

    if (autoApproveAtFullConfidence) {
      const call = createAiCall({
        geminiApiKey: getSecretValue(GEMINI_API_KEY),
        openAiApiKey: getSecretValue(OPENAI_API_KEY),
      });

      const verdict = await gradeAttempt({
        contract,
        answer,
        attemptNumber: effectiveAttempt,
        isCorrectionAfterModelAnswer,
        previousState,
        call,
      });

      if (shouldAutoApprove(verdict.confidence, autoApproveAtFullConfidence)) {
        const feedback = await composeFeedback({ contract, verdict, answer, attemptNumber: effectiveAttempt, call });
        const hintsUsed = Math.max(0, effectiveAttempt - 1);

        await attemptsRef.add({
          ...baseAttemptFields,
          hintShown: hintForAttempt(contract, effectiveAttempt).level,
          rubricScores: verdict.rubricScores,
          weightedScore: verdict.weightedScore,
          confidence: verdict.confidence,
          rationale: verdict.rationale,
          masteryState: verdict.masteryState,
          requiresTeacherReview: false,
          pendingTeacherApproval: false,
          autoApproved: true,
          schemaVersion: verdict.schemaVersion,
          modelVersion: verdict.modelVersion,
          feedbackMessage: feedback.message,
        });

        await recordAttemptInProfile(studentUid, String(task.teacherId || ''), contract, verdict, effectiveAttempt, hintsUsed);

        // Kursant dostaje feedback i stan. Bez procentu, bez słupka (§3.1).
        return {
          message: feedback.message,
          masteryState: feedback.masteryState,
          nextHint: feedback.nextHint,
          revealModelAnswer: feedback.revealModelAnswer,
          modelAnswer: feedback.modelAnswer,
          attemptsLeft: feedback.attemptsLeft,
          attemptNumber: effectiveAttempt,
          requiresTeacherReview: false,
          pendingTeacherApproval: false,
        };
      }

      // Pewność poniżej 100% mimo włączonego przełącznika — zostaje jako
      // propozycja do przejrzenia, werdykt NIE trafia do kursanta.
      await attemptsRef.add({
        ...baseAttemptFields,
        rubricScores: verdict.rubricScores,
        weightedScore: verdict.weightedScore,
        confidence: verdict.confidence,
        rationale: verdict.rationale,
        masteryState: verdict.masteryState,
        requiresTeacherReview: true,
        pendingTeacherApproval: true,
        schemaVersion: verdict.schemaVersion,
        modelVersion: verdict.modelVersion,
      });

      return {
        message: 'Twoja odpowiedź została zapisana. Nauczyciel ją sprawdzi.',
        masteryState: previousState,
        nextHint: null,
        revealModelAnswer: false,
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - effectiveAttempt),
        attemptNumber: effectiveAttempt,
        requiresTeacherReview: true,
        pendingTeacherApproval: true,
      };
    }

    // Domyślne zachowanie: silnik oceny się NIE uruchamia. Praca czeka na
    // przycisk lektora „Zaproponuj ocenę z AI" (patrz `proposeHomeworkV2Grade`).
    await attemptsRef.add({
      ...baseAttemptFields,
      requiresTeacherReview: true,
      pendingTeacherApproval: true,
    });

    return {
      message: 'Twoja odpowiedź została zapisana. Nauczyciel ją sprawdzi.',
      masteryState: previousState,
      nextHint: null,
      revealModelAnswer: false,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - effectiveAttempt),
      attemptNumber: effectiveAttempt,
      requiresTeacherReview: true,
      pendingTeacherApproval: true,
    };
  }
);

// ---------------------------------------------------------------------------
// 3b. Propozycja oceny na życzenie lektora
// ---------------------------------------------------------------------------

/**
 * Uruchamia silnik oceny dla JEDNEJ próby, na żądanie lektora.
 *
 * Nic nie zapisuje w `attempts` — zwraca propozycję do edycji w UI. Dopiero
 * `approveHomeworkV2Grade` utrwala (ewentualnie poprawiony) werdykt i wysyła
 * go kursantowi. To jest przycisk „✨ Zaproponuj ocenę z AI".
 */
export const proposeHomeworkV2Grade = onCall(
  { region: FUNCTION_REGION, secrets: [GEMINI_API_KEY, OPENAI_API_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    requireHomeworkEngineV2();
    await requireTeacherUid(request.auth?.uid);

    const taskId = String(request.data?.taskId || '').trim();
    const attemptId = String(request.data?.attemptId || '').trim();
    if (!taskId || !attemptId) throw new HttpsError('invalid-argument', 'Brak zadania lub próby.');

    const taskRef = getDb().collection('specialTasks').doc(taskId);
    const [taskSnap, attemptSnap] = await Promise.all([taskRef.get(), taskRef.collection('attempts').doc(attemptId).get()]);

    if (!taskSnap.exists) throw new HttpsError('not-found', 'Zadanie nie istnieje.');
    if (!attemptSnap.exists) throw new HttpsError('not-found', 'Próba nie istnieje.');

    const task = taskSnap.data() as Record<string, unknown>;
    const attempt = attemptSnap.data() as Record<string, unknown>;

    const exercises = Array.isArray(task.sentences) ? task.sentences : [];
    const contract = exercises.find(
      (item: unknown) => (item as ExerciseContractV2)?.id === attempt.exerciseId
    ) as ExerciseContractV2 | undefined;
    if (!contract) throw new HttpsError('not-found', 'Ćwiczenie nie należy do tego zadania.');

    const call = createAiCall({
      geminiApiKey: getSecretValue(GEMINI_API_KEY),
      openAiApiKey: getSecretValue(OPENAI_API_KEY),
    });

    const verdict = await gradeAttempt({
      contract,
      answer: String(attempt.answer || ''),
      attemptNumber: (attempt.attemptNumber || 1) as AttemptNumber,
      isCorrectionAfterModelAnswer: attempt.isCorrectionAfterModelAnswer === true,
      previousState: 'nowe',
      call,
    });

    const feedback = await composeFeedback({
      contract,
      verdict,
      answer: String(attempt.answer || ''),
      attemptNumber: (attempt.attemptNumber || 1) as AttemptNumber,
      call,
    });

    return { verdict, feedbackMessage: feedback.message };
  }
);

// ---------------------------------------------------------------------------
// 3c. Zatwierdzenie oceny przez lektora
// ---------------------------------------------------------------------------

/**
 * Utrwala werdykt (ewentualnie poprawiony przez lektora w UI) i odblokowuje
 * feedback dla kursanta. To jest przycisk „Zatwierdź i wyślij do kursanta".
 */
export const approveHomeworkV2Grade = onCall(
  { region: FUNCTION_REGION, timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    requireHomeworkEngineV2();
    const teacherUid = await requireTeacherUid(request.auth?.uid);

    const taskId = String(request.data?.taskId || '').trim();
    const attemptId = String(request.data?.attemptId || '').trim();
    const verdict = request.data?.verdict as GradingVerdictV2 | undefined;
    const feedbackMessage = String(request.data?.feedbackMessage || '').trim();

    if (!taskId || !attemptId) throw new HttpsError('invalid-argument', 'Brak zadania lub próby.');
    if (!verdict) throw new HttpsError('invalid-argument', 'Brak werdyktu do zatwierdzenia.');

    const attemptRef = getDb().collection('specialTasks').doc(taskId).collection('attempts').doc(attemptId);
    const attemptSnap = await attemptRef.get();
    if (!attemptSnap.exists) throw new HttpsError('not-found', 'Próba nie istnieje.');

    await attemptRef.update({
      rubricScores: verdict.rubricScores,
      weightedScore: verdict.weightedScore,
      confidence: verdict.confidence,
      rationale: verdict.rationale,
      masteryState: verdict.masteryState,
      requiresTeacherReview: false,
      pendingTeacherApproval: false,
      schemaVersion: verdict.schemaVersion,
      modelVersion: verdict.modelVersion,
      feedbackMessage,
      teacherApprovedAt: new Date().toISOString(),
      teacherApprovedBy: teacherUid,
    });

    const attempt = attemptSnap.data() as Record<string, unknown>;
    const taskSnap = await getDb().collection('specialTasks').doc(taskId).get();
    const task = taskSnap.data() as Record<string, unknown> | undefined;
    const exercises = Array.isArray(task?.sentences) ? (task!.sentences as unknown[]) : [];
    const contract = exercises.find(
      (item) => (item as ExerciseContractV2)?.id === attempt.exerciseId
    ) as ExerciseContractV2 | undefined;

    if (task && contract) {
      await recordAttemptInProfile(
        String(attempt.studentUid || task.studentUid || ''),
        String(task.teacherId || teacherUid),
        contract,
        verdict,
        (attempt.attemptNumber || 1) as AttemptNumber,
        Math.max(0, ((attempt.attemptNumber || 1) as number) - 1)
      ).catch(() => {
        // Profil nauki to statystyka, nie warunek zatwierdzenia oceny.
      });
    }

    return { ok: true };
  }
);

// ---------------------------------------------------------------------------
// 4. Propozycja powtórki
// ---------------------------------------------------------------------------

/** Lista dla lektora. Niczego nie przydziela — od tego jest jego decyzja. */
export const proposeHomeworkV2Review = onCall(
  { region: FUNCTION_REGION, timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    requireHomeworkEngineV2();
    await requireTeacherUid(request.auth?.uid);

    const studentUid = String(request.data?.studentUid || '').trim();
    if (!studentUid) throw new HttpsError('invalid-argument', 'Nie wskazano kursanta.');

    return { proposals: await proposeReview(studentUid) };
  }
);
