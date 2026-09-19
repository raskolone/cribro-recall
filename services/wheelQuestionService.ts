import { LessonRecord, PresentationSlide, GeneratedLessonScenario } from '../types';
import { generateLessonPlannerAI, extractJSON } from './geminiService';
import { extractLessonBlocks } from '../utils/lessonBlocks';
import { runCouncil, WARMUP_REVIEW_SYSTEM } from './aiCouncil';

export type ChallengeCategoryId =
  | 'collocation'
  | 'fix_error'
  | 'pitch_60s'
  | 'fill_gap'
  | 'translation'
  | 'upgrade_c1';

/**
 * 6 stałych kategorii wyzwań rozgrzewkowych renderowanych na tarczy koła.
 * Tarcza zawsze ma te same wycinki (nazwa + ikona) — treść merytoryczna
 * przypisana do wylosowanej kategorii pochodzi z puli pytań i pojawia się
 * wyłącznie w karcie wyniku (patrz `assignChallengeCategory`).
 */
export const CHALLENGE_CATEGORIES: { id: ChallengeCategoryId; label: string }[] = [
  { id: 'collocation', label: 'Collocation' },
  { id: 'fix_error', label: 'Fix Error' },
  { id: 'pitch_60s', label: '60s Pitch' },
  { id: 'fill_gap', label: 'Fill Gap' },
  { id: 'translation', label: 'Translation' },
  { id: 'upgrade_c1', label: 'Upgrade C1' },
];

/**
 * Deterministyczny hash krótkiego stringa (id pytania) do stabilnego
 * przypisania kategorii wyzwania — to samo pytanie zawsze trafia w tę samą
 * kategorię w obrębie sesji, niezależnie od kolejności ponownych renderów.
 */
const stableHash = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const assignChallengeCategory = (id: string): ChallengeCategoryId => {
  return CHALLENGE_CATEGORIES[stableHash(id) % CHALLENGE_CATEGORIES.length].id;
};

const withChallengeCategories = (items: WheelQuestionItem[]): WheelQuestionItem[] =>
  items.map(item => ({ ...item, challengeCategory: item.challengeCategory || assignChallengeCategory(item.id) }));

export interface WheelQuestionItem {
  id: string;
  question: string;
  category: 'scenario' | 'past_lessons' | 'custom';
  sourceTag?: string;
  followUpHint?: string;
  relatedWord?: string;
  /** Stała kategoria wyzwania (jedna z 6 wycinków tarczy) przypisana treści. */
  challengeCategory?: ChallengeCategoryId;
}

/**
 * Standardowe, uniwersalne pytania rozgrzewkowe (ADHD-friendly, conversation starters),
 * gdy brak wystarczającej ilości danych w scenariuszu lub historii.
 */
export const FALLBACK_WARMUP_QUESTIONS: WheelQuestionItem[] = [
  {
    id: 'w-fb-1',
    question: 'What was the highlight or most unexpected moment of your week so far?',
    category: 'scenario',
    sourceTag: 'Icebreaker',
    followUpHint: 'Try to use past continuous or descriptive adjectives.'
  },
  {
    id: 'w-fb-2',
    question: 'If you had an extra 2 hours of free time today, how would you spend it?',
    category: 'scenario',
    sourceTag: 'Hypothetical',
    followUpHint: 'Use second conditional: "If I had... I would..."'
  },
  {
    id: 'w-fb-3',
    question: 'What is one work tool, app, or habit that makes your life significantly easier?',
    category: 'scenario',
    sourceTag: 'Productivity',
    followUpHint: 'Explain why it stands out compared to other solutions.'
  },
  {
    id: 'w-fb-4',
    question: 'Which do you prefer: diving into a challenging task in the morning or planning it out first?',
    category: 'scenario',
    sourceTag: 'Opinion',
    followUpHint: 'Give a concrete example from your recent work.'
  },
  {
    id: 'w-fb-5',
    question: 'What is a piece of advice or feedback you received recently that stuck with you?',
    category: 'scenario',
    sourceTag: 'Reflection',
    followUpHint: 'Who gave it to you and how did you apply it?'
  },
  {
    id: 'w-fb-6',
    question: 'If you had to master any new skill in 30 days without failing, what would you choose?',
    category: 'scenario',
    sourceTag: 'Challenge',
    followUpHint: 'Focus on reasons and potential benefits.'
  },
  {
    id: 'w-fb-7',
    question: 'What was the last thing that pleasantly surprised you at work or outside of it?',
    category: 'scenario',
    sourceTag: 'Experience',
    followUpHint: 'Describe the situation and your initial reaction.'
  },
  {
    id: 'w-fb-8',
    question: 'Radical candour vs diplomatic tact: which is more valuable in day-to-day teamwork?',
    category: 'scenario',
    sourceTag: 'Dilemma',
    followUpHint: 'Provide arguments for both sides before making your choice.'
  }
];

/**
 * Wyciąga pytania do Koła Fortuny z aktualnego scenariusza lub slajdu.
 */
export function extractQuestionsFromScenario(
  slide?: PresentationSlide | null,
  scenario?: GeneratedLessonScenario | null
): WheelQuestionItem[] {
  const list: WheelQuestionItem[] = [];

  // 1. Z zapisanych pytań na slajdzie koła
  if (slide?.wheelQuestions && slide.wheelQuestions.length > 0) {
    slide.wheelQuestions.forEach((q, idx) => {
      if (q.question && q.question.trim()) {
        list.push({
          id: q.id || `sc-wq-${idx}`,
          question: q.question.trim(),
          category: 'scenario',
          sourceTag: 'Scenariusz lekcji'
        });
      }
    });
  }

  // 2. Ze slajdu typu warmup/speaking (items)
  if (list.length < 4 && slide?.items && slide.items.length > 0) {
    slide.items.forEach((item, idx) => {
      const qText = item.question || item.term;
      if (qText && qText.trim() && !list.some(l => l.question === qText.trim())) {
        list.push({
          id: item.id || `sc-item-${idx}`,
          question: qText.trim(),
          category: 'scenario',
          sourceTag: 'Warm-up zagadnienie',
          followUpHint: item.example || item.hint
        });
      }
    });
  }

  // 3. Ze scenariusza (thoughtProvokingQuestions, stages)
  if (list.length < 6 && scenario) {
    const thoughtQuestions = (scenario as any).thoughtProvokingQuestions;
    if (thoughtQuestions && Array.isArray(thoughtQuestions) && thoughtQuestions.length > 0) {
      thoughtQuestions.forEach((tpq: any, idx: number) => {
        const text = typeof tpq === 'string' ? tpq : tpq?.question || tpq?.text;
        if (text && text.trim() && !list.some(l => l.question === text.trim())) {
          list.push({
            id: `sc-tpq-${idx}`,
            question: text.trim(),
            category: 'scenario',
            sourceTag: 'Thought-provoking'
          });
        }
      });
    }

    if (scenario.stages && scenario.stages.length > 0) {
      scenario.stages.forEach((st, sIdx) => {
        const titleLower = st.title.toLowerCase();
        if (titleLower.includes('warm') || titleLower.includes('lead') || titleLower.includes('rozmow')) {
          const lines = (st.body || '').split('\n').map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(l => l.includes('?') || l.length > 15);
          lines.forEach((line, lIdx) => {
            if (line && !list.some(l => l.question === line)) {
              list.push({
                id: `sc-stage-${sIdx}-${lIdx}`,
                question: line,
                category: 'scenario',
                sourceTag: st.title.slice(0, 24)
              });
            }
          });
        }
      });
    }
  }

  // Uzupełnij brakujące do co najmniej 6 pytań fallbackiem
  if (list.length < 6) {
    FALLBACK_WARMUP_QUESTIONS.forEach(fb => {
      if (list.length < 8 && !list.some(l => l.question === fb.question)) {
        list.push({ ...fb, id: `fb-${list.length + 1}` });
      }
    });
  }

  return withChallengeCategories(list.slice(0, 10));
}

/**
 * Wyciąga i generuje inteligentne pytania rekapitulacyjne z historii poprzednich lekcji kursanta.
 * Korzysta z pełnego układu 4 bloków Notion (Słownictwo, Korekty, Podsumowanie, Zadanie domowe).
 */
export function extractQuestionsFromPastLessons(
  lessonRecords: LessonRecord[] = [],
  studentName?: string | null
): WheelQuestionItem[] {
  const list: WheelQuestionItem[] = [];

  if (!lessonRecords || lessonRecords.length === 0) {
    const studentGreeting = studentName ? `Witaj ${studentName}! ` : '';
    return [
      {
        id: 'pl-empty-1',
        question: `${studentGreeting}Brak wcześniejszych lekcji w historii. Jakie są Twoje główne cele językowe na ten kurs?`,
        category: 'past_lessons',
        sourceTag: 'Pierwsza lekcja',
        followUpHint: 'Opowiedz o sytuacjach, w których najbardziej potrzebujesz swobodnego angielskiego.'
      },
      ...FALLBACK_WARMUP_QUESTIONS.slice(0, 7).map((fb, idx) => ({
        ...fb,
        id: `pl-empty-${idx + 2}`,
        category: 'past_lessons' as const,
        sourceTag: 'Rozgrzewka startowa'
      }))
    ];
  }

  // Sortuj lekcje od najnowszych
  const sortedLessons = [...lessonRecords].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });

  sortedLessons.forEach((rec, rIdx) => {
    if (list.length >= 10) return;

    const blocks = extractLessonBlocks(rec);
    const topic = rec.topic?.trim() || 'poprzednia lekcja';
    const dateFormatted = rec.date ? new Date(rec.date).toLocaleDateString('pl-PL') : `Lekcja #${rIdx + 1}`;

    // 1. Z kluczowych słówek (Words & Phrases / Block 2)
    if (blocks.vocabulary && blocks.vocabulary.trim().length > 3 && list.length < 10) {
      const vocabLines = blocks.vocabulary
        .split('\n')
        .map(l => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(l => l.length > 2 && !l.toLowerCase().includes('brak'));

      if (vocabLines.length > 0) {
        // Weź do 2 słówek z danej lekcji
        const sampleWords = vocabLines.slice(0, 2);
        sampleWords.forEach((wordLine, wIdx) => {
          if (list.length >= 10) return;
          const cleanWord = wordLine.split(/\s+[-–—:=]\s+/)[0].trim().replace(/[*_]/g, '');
          const wordMeaning = wordLine.includes('-') ? wordLine.split(/\s+[-–—:=]\s+/)[1]?.trim() : '';

          const variations = [
            `Vocabulary Recall: Use the phrase "${cleanWord}" in a natural sentence about your recent work or week.`,
            `Context Challenge: Explain what "${cleanWord}" means in English and give a quick practical example.`,
            `Quick Collocation: What prepositions or words go naturally with "${cleanWord}"? Create a short scenario.`
          ];
          const chosenQuestion = variations[(rIdx + wIdx) % variations.length];

          if (!list.some(item => item.relatedWord === cleanWord || item.question === chosenQuestion)) {
            list.push({
              id: `pl-voc-${rIdx}-${wIdx}`,
              question: chosenQuestion,
              category: 'past_lessons',
              sourceTag: `Słówko: ${cleanWord.slice(0, 20)}`,
              relatedWord: cleanWord,
              followUpHint: wordMeaning ? `Znaczenie: ${wordMeaning}` : `Z lekcji: ${topic}`
            });
          }
        });
      }
    }

    // 2. Z punktów do poprawy / korekt (Accuracy & Corrections)
    if (blocks.corrections && blocks.corrections.trim().length > 5 && list.length < 10) {
      const fixLines = blocks.corrections
        .split('\n')
        .map(l => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(l => l.length > 6 && !l.toLowerCase().includes('brak'));

      if (fixLines.length > 0) {
        const fixLine = fixLines[0];
        const accuracyQuestion = `Accuracy Check: In our lesson on "${topic}", we corrected: "${fixLine.slice(0, 95)}". How would you express this correctly now?`;

        if (!list.some(item => item.question === accuracyQuestion)) {
          list.push({
            id: `pl-fix-${rIdx}`,
            question: accuracyQuestion,
            category: 'past_lessons',
            sourceTag: `Korekta (${dateFormatted})`,
            followUpHint: 'Zwróć uwagę na precyzyjną strukturę gramatyczną i dobór słów.'
          });
        }
      }
    }

    // 3. Z kolejnych kroków / follow-up / nextLesson
    if (blocks.nextLesson && blocks.nextLesson.trim().length > 8 && list.length < 10) {
      const nextLines = blocks.nextLesson
        .split('\n')
        .map(l => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(l => l.length > 10);

      if (nextLines.length > 0) {
        const line = nextLines[0];
        const formulated = line.includes('?') 
          ? line 
          : `Follow-up from "${topic}": ${line}`;

        if (!list.some(item => item.question === formulated)) {
          list.push({
            id: `pl-next-${rIdx}`,
            question: formulated,
            category: 'past_lessons',
            sourceTag: `Follow-up (${dateFormatted})`,
            followUpHint: `Nawiązanie do zagadnienia z lekcji: ${topic}`
          });
        }
      }
    }

    // 4. Z tematu lekcji i podsumowania (Discussion continuation)
    if (topic && topic.length > 3 && topic !== 'poprzednia lekcja' && list.length < 10) {
      const topicQuestion = `Reflection: Regarding our session on "${topic}" (${dateFormatted}) — have you had an opportunity to use this or encountered a related topic recently?`;

      if (!list.some(item => item.question === topicQuestion)) {
        list.push({
          id: `pl-topic-${rIdx}`,
          question: topicQuestion,
          category: 'past_lessons',
          sourceTag: `Temat: ${topic.slice(0, 22)}`
        });
      }
    }
  });

  // Uzupełnij do minimum 6 pytań jeśli historia była bardzo krótka
  if (list.length < 6) {
    FALLBACK_WARMUP_QUESTIONS.forEach(fb => {
      if (list.length < 8 && !list.some(l => l.question === fb.question)) {
        list.push({
          ...fb,
          id: `pl-fallback-${list.length + 1}`,
          category: 'past_lessons',
          sourceTag: 'Konwersacja rekapitulacyjna'
        });
      }
    });
  }

  return withChallengeCategories(list.slice(0, 10));
}

/**
 * Generuje błyskawicznie przez AI świeże pytania do koła fortuny.
 */
export async function generateWheelQuestionsAI(
  topic: string,
  level: string = 'B2',
  context?: string
): Promise<WheelQuestionItem[]> {
  const prompt = `ROLE: Expert English ESL Warm-Up Creator.
TASK: Generate 8 engaging, conversation-sparking, natural warm-up questions for an English lesson.
TOPIC: ${topic || 'Professional and everyday communication'}
STUDENT LEVEL: ${level}
CONTEXT: ${context || 'General conversational lesson'}

RULES:
- Questions MUST spark natural conversation (60-90s spoken answers).
- Diverse angles: 1 opinion, 1 hypothetical, 1 practical work scenario, 1 personal experience, 1 dilemma, 1 productivity habit.
- Language: Modern, natural English.
- Return ONLY a JSON array of objects:
[
  {
    "question": "Full English question text?",
    "sourceTag": "Category tag (e.g. Opinion / Dilemma / Experience)",
    "followUpHint": "Optional short hint or grammar focus in Polish or English"
  }
]`;

  try {
    const councilRes = await runCouncil<any[]>({
      systemInstruction: 'You are an elite ESL conversation coach crafting engaging warm-up questions. Return valid JSON only.',
      prompt,
      reviewerSystemInstruction: WARMUP_REVIEW_SYSTEM,
      expectJson: true,
    });
    const parsed = councilRes.data;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return withChallengeCategories(parsed.slice(0, 10).map((item: any, idx: number) => ({
        id: `ai-wq-${Date.now()}-${idx}`,
        question: item.question,
        category: 'scenario' as const,
        sourceTag: item.sourceTag || 'AI Generated',
        followUpHint: item.followUpHint
      })));
    }
  } catch (err) {
    console.warn('[WheelQuestionService] AI council generation failed, using fallback:', err);
  }

  return withChallengeCategories(FALLBACK_WARMUP_QUESTIONS);
}
