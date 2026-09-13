import { LessonRecord } from '../types';
import {
  buildTranscriptLessonPrompt,
  parseTranscriptLesson,
  TranscriptLessonError,
  TRANSCRIPT_SYSTEM_INSTRUCTION,
  type TranscriptLessonInput,
} from '../utils/transcriptLesson';
import { extractJSON, generateTextWithUnifiedFallback } from './geminiService';

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
  return parseTranscriptLesson(extractJSON(text));
}

export { TranscriptLessonError };
