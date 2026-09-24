import { generateTextWithUnifiedFallback } from './geminiService';
import { LessonRecord } from '../types';

export type RecallType =
  | 'auto'
  | 'personal'
  | 'correct'
  | 'complete'
  | 'translate'
  | 'dialogue'
  | 'situation';

export const RECALL_TYPE_LABELS: Record<RecallType, string> = {
  auto: 'Auto-select',
  personal: 'Make it personal',
  correct: 'Correct the sentence',
  complete: 'Complete the sentence',
  translate: 'Translate short sentences',
  dialogue: 'Mini-dialogue',
  situation: 'Recall from a situation',
};

const stripCodeFence = (text: string): string =>
  text
    .trim()
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

/**
 * System prompt generator dla Quick Recall.
 */
const buildQuickRecallPrompt = (
  recallType: RecallType,
  studentLevel?: string
): string => {
  const isA1A2 = studentLevel && /^(A1|A2|A1\/A2|dolne A2|A0)$/i.test(studentLevel.trim());

  return `Jesteś metodykiem języka angielskiego w aplikacji Cribro English. Twoim zadaniem jest wygenerowanie jednego, zwięzłego ćwiczenia powtórkowego „Quick Recall” dla lektora do prowadzenia lekcji.

POZIOM KURSANTA: ${studentLevel || 'B1 (Standard)'} ${isA1A2 ? '— [POZIOM A1 / DOLNE A2: BARDZO PROSTE, SENTENCE FRAMES OBOWIĄZKOWE]' : ''}
TYP RECALL: ${RECALL_TYPE_LABELS[recallType] || 'Auto-select'}

ZASADY POBIERANIA I WYBORU MATERIAŁU:
1. Bazuj WYŁĄCZNIE na przekazanych danych ze wskazanej lekcji (Key Language / Vocabulary, Corrections / Błędy, ewentualnie Next Lesson i praca domowa).
2. Wybierz 3–5 elementów łącznie (preferuj 1–2 korekty oraz 2–3 zwroty/słowa).
3. Nie wprowadzaj nowego słownictwa spoza notatek.
4. Nie twórz sztucznych błędów niepowiązanych z historią kursanta.
5. Nie generuj Answer Key (klucza odpowiedzi).
6. Generuj dokładnie JEDNO zwięzłe ćwiczenie, nie pakiet zadań.

${
  isA1A2
    ? `SPECJALNE REGUŁY DLA A1 / DOLNEGO A2:
- Generuj MAKSYMALNIE 3 elementy.
- Bezpośrednio pod instrukcją ćwiczenia wstaw sekcję „Useful frames:” z widocznymi modelami zdań (np. "Useful frames:<br>• I always... when I...<br>• In my opinion, it is...").
- Preferuj wybór A/B, uzupełnienie krótkiego zdania lub poprawę jednej formy.
- Unikaj długich tłumaczeń i otwartych, abstrakcyjnych pytań.
- Zadanie ma prowadzić do krótkiej, prostej własnej wypowiedzi.`
    : ''
}

OPISY TYPÓW ĆWICZENIA:
- 'Auto-select': Samodzielnie dobierz najbardziej naturalny format (dialog, dokończenie zdań lub spersonalizowane pytanie) pod kątem podanych korekt i słownictwa.
- 'Make it personal': Pytania konwersacyjne lub prompty wymagające od kursanta użycia przypomnianych zwrotów w odniesieniu do jego doświadczeń/pracy.
- 'Correct the sentence': 3-4 zdania zawierające dokładnie te błędy gramatyczne/językowe, które kursant popełnił na poprzedniej lekcji, z zadaniem ich poprawienia.
- 'Complete the sentence': Zdania z lukami (fill-in-the-blanks) do uzupełnienia kluczowymi zwrotami z lekcji.
- 'Translate short sentences': Krótkie zdania po polsku do przetłumaczenia na angielski, sprawdzające utrwalenie zwrotów i poprawek.
- 'Mini-dialogue': Krótka wymiana 2-3 wypowiedzi w parach (A/B) z lukami lub rolą do dokończenia.
- 'Recall from a situation': Krótki opis miniaturowej sytuacji (1-2 zdania), w której kursant musi zareagować odpowiednim zwrotem z poprzedniej lekcji.

FORMAT WYJŚCIOWY (CZYSTY KOD HTML, bez znaczników markdown \`\`\`):
<p><strong>[Krótka, jasna instrukcja po angielsku dla kursanta / lektora]</strong></p>
${isA1A2 ? `<p><em>Useful frames:</em><br>• [Sentence frame 1]<br>• [Sentence frame 2]</p>` : ''}
<ol>
  <li>[Punkt 1]</li>
  <li>[Punkt 2]</li>
  <li>[Punkt 3]</li>
</ol>

Zwróć WYŁĄCZNIE powyższy fragment HTML — bez wstępu, bez znaczników markdown, bez podsumowań.`;
};

/**
 * Generuje aktywność Quick Recall na podstawie wybranej lekcji źródłowej.
 */
export const generateQuickRecallActivity = async (params: {
  sourceLesson: LessonRecord;
  recallType?: RecallType | string;
  studentLevel?: string;
  sourceLabel?: string;
}): Promise<string> => {
  const { sourceLesson, studentLevel } = params;
  const rawType = (params.recallType || 'auto') as RecallType;
  const type: RecallType = RECALL_TYPE_LABELS[rawType] ? rawType : 'auto';

  // Zbuduj czytelny materiał źródłowy wyłącznie z pól lekcji
  const vocabText = sourceLesson.vocabularyText || sourceLesson.structuredBlocks?.vocabulary || '';
  const correctionsText = sourceLesson.corrections || sourceLesson.structuredBlocks?.corrections || sourceLesson.thingsToImprove || '';
  const summaryText = sourceLesson.lessonSummary || sourceLesson.structuredBlocks?.summary || '';
  const nextLessonText = sourceLesson.nextLessonPlan || sourceLesson.structuredBlocks?.nextLesson || sourceLesson.suggestedFollowUp || '';
  const homeworkText = sourceLesson.homeworkText || sourceLesson.structuredBlocks?.homework || '';

  const structuredNotes = [
    sourceLesson.topic && `Lesson Topic: ${sourceLesson.topic}`,
    vocabText && `Key Language & Vocabulary:\n${vocabText}`,
    correctionsText && `Corrections & Mistakes to revisit:\n${correctionsText}`,
    homeworkText && `Previous Homework Task/Result:\n${homeworkText}`,
    nextLessonText && `Next Lesson Focus:\n${nextLessonText}`,
    summaryText && `Lesson Summary Context:\n${summaryText}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const contentPrompt = structuredNotes.trim().length > 0 ? structuredNotes : `Topic: ${sourceLesson.topic || 'General Practice'}`;

  const sourceLabel =
    params.sourceLabel ||
    (sourceLesson.topic
      ? `${sourceLesson.date} — ${sourceLesson.topic}`
      : sourceLesson.date);

  const recallTypeName = RECALL_TYPE_LABELS[type] || 'Auto-select';

  const systemPrompt = buildQuickRecallPrompt(type, studentLevel);
  const userPrompt = `DANE LEKCJI ŹRÓDŁOWEJ:\n${contentPrompt}\n\nPrzygotuj ćwiczenie Quick Recall typu "${recallTypeName}".`;

  try {
    const { text } = await generateTextWithUnifiedFallback(
      userPrompt,
      systemPrompt,
      undefined,
      { thinkingConfig: { thinkingBudget: 0 } },
      undefined,
      { taskName: 'Generowanie Quick Recall (Notatnik)' }
    );

    const generatedBody = stripCodeFence(text);

    // Zwróć sformatowany blok ze standardowym nagłówkiem źródła i typu
    const headerHtml = `<p class="text-xs text-content-muted" style="margin-bottom: 8px; opacity: 0.85;"><strong>Source:</strong> Lesson ${sourceLabel}<br><strong>Recall type:</strong> ${recallTypeName}</p>`;
    return `${headerHtml}${generatedBody}`;
  } catch (error) {
    console.error('[QUICK_RECALL_AI_ERROR]', error);
    // Inteligentny fallback w razie błędu API
    const fallbackVocab = vocabText.split('\n').filter(Boolean).slice(0, 3).map(v => `<li>${v.trim()}</li>`).join('');
    const fallbackCorrections = correctionsText.split('\n').filter(Boolean).slice(0, 2).map(c => `<li>${c.trim()}</li>`).join('');

    return (
      `<p class="text-xs text-content-muted" style="margin-bottom: 8px; opacity: 0.85;"><strong>Source:</strong> Lesson ${sourceLabel}<br><strong>Recall type:</strong> ${recallTypeName}</p>` +
      `<p><strong>Review the key language and corrections from the previous lesson:</strong></p>` +
      (fallbackCorrections ? `<p><em>Corrections to revisit:</em></p><ul>${fallbackCorrections}</ul>` : '') +
      (fallbackVocab ? `<p><em>Key words:</em></p><ul>${fallbackVocab}</ul>` : '')
    );
  }
};

/**
 * Zgodność wsteczna z poprzednimi wywołaniami.
 */
export const generateLessonRevision = async (previousLessonContent: string): Promise<string> => {
  const now = new Date().toISOString();
  const dummyLesson: LessonRecord = {
    id: 'legacy-lesson',
    studentId: '',
    date: now.split('T')[0],
    topic: 'Previous Lesson',
    vocabularyText: previousLessonContent,
    corrections: previousLessonContent,
    createdAt: now,
    updatedAt: now,
  };
  return generateQuickRecallActivity({ sourceLesson: dummyLesson, recallType: 'auto' });
};
