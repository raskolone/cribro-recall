import { LessonRecord, QuestionUsageLog } from '../types';
import {
  buildTranscriptLessonPrompt,
  parseTranscriptLesson,
  TranscriptLessonError,
  TRANSCRIPT_SYSTEM_INSTRUCTION,
  type TranscriptLessonInput,
} from '../utils/transcriptLesson';
import { extractJSON, generateTextWithUnifiedFallback } from './geminiService';
import { db } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Wywołanie modelu dla lekcji z transkrypcji.
 *
 * Cała treść polecenia i rozbiór odpowiedzi siedzą w
 * `utils/transcriptLesson.ts` — tutaj zostaje wyłącznie to, co wymaga sieci.
 * Dzięki temu kaskada dostawców, monitor AI i obsługa błędów są te same, co
 * w każdym innym zadaniu AI w tej aplikacji, a logika lekcji nie zależy od
 * żadnego z nich.
 */
export async function generateLessonFromTranscript(
  input: TranscriptLessonInput
): Promise<Partial<LessonRecord>> {
  const transcript = input.transcript?.trim();
  if (!transcript) {
    throw new TranscriptLessonError('Ta lekcja nie ma jeszcze transkrypcji.');
  }

  const { text } = await generateTextWithUnifiedFallback(
    buildTranscriptLessonPrompt({ ...input, transcript }),
    TRANSCRIPT_SYSTEM_INSTRUCTION,
    undefined,
    { responseMimeType: 'application/json' },
    undefined,
    { taskName: 'Lekcja z transkrypcji', category: 'lesson' }
  );

  /*
   * `extractJSON` zdejmuje to, co modele dokładają wokół JSON-a mimo zakazu:
   * ogrodzenie ```json, zdanie wstępne, przecinek na końcu. Bez tego jedna
   * odpowiedź na kilka kończyła się błędem składni na treści, która była
   * poprawna.
   */
  const parsed = parseTranscriptLesson(extractJSON(text), {
    lessonId: input.lessonId,
    studentId: input.studentId,
    date: input.date,
  });

  return parsed;
}

/**
 * Zapisuje ukryte logi pytań (lesson_question_logs) w Firestore.
 */
export async function persistQuestionUsageLogs(
  studentId: string,
  lessonId: string,
  logs: QuestionUsageLog[]
): Promise<void> {
  if (!logs || logs.length === 0) return;
  try {
    for (const log of logs) {
      const docId = log.questionLogId || `ql_${lessonId}_${log.sequence}`;
      const logRef = doc(db, `users/${studentId}/lesson_question_logs/${docId}`);
      await setDoc(logRef, log, { merge: true });
    }
  } catch (err) {
    console.warn('[Question Logs] Nie udało się zapisać pytań:', err);
  }
}

/**
 * Aktualizuje profil kursanta w users/{studentId} o trwałe obserwacje z transkrypcji.
 */
export async function updateStudentInsightsProfile(
  studentId: string,
  insights: string
): Promise<void> {
  if (!studentId || !insights || !insights.trim()) return;
  try {
    const userRef = doc(db, 'users', studentId);
    await updateDoc(userRef, {
      studentInsights: insights.trim(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Student Insights] Nie udało się zaktualizować profilu kursanta:', err);
  }
}

export { TranscriptLessonError };

