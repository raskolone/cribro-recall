import { LessonRecord, PresentationSlide, GeneratedLessonScenario } from '../types';
import { generateLessonPlannerAI, extractJSON } from './geminiService';

export interface WheelQuestionItem {
  id: string;
  question: string;
  category: 'scenario' | 'past_lessons' | 'custom';
  sourceTag?: string;
  followUpHint?: string;
  relatedWord?: string;
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

  return list.slice(0, 10);
}

/**
 * Wyciąga i generuje inteligentne pytania rekapitulacyjne z historii poprzednich lekcji kursanta.
 */
export function extractQuestionsFromPastLessons(
  lessonRecords: LessonRecord[] = [],
  studentName?: string | null
): WheelQuestionItem[] {
  const list: WheelQuestionItem[] = [];

  if (!lessonRecords || lessonRecords.length === 0) {
    return [
      {
        id: 'pl-empty-1',
        question: `Brak wcześniejszych lekcji w historii. Jakie są Twoje główne cele językowe na ten kurs?`,
        category: 'past_lessons',
        sourceTag: 'Pierwsza lekcja'
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

    const topic = rec.topic?.trim();
    const dateFormatted = rec.date ? new Date(rec.date).toLocaleDateString('pl-PL') : `Lekcja #${rIdx + 1}`;

    // 1. Z suggestedFollowUp (często zawiera pytania otwarte lektora)
    if (rec.suggestedFollowUp && rec.suggestedFollowUp.trim().length > 10) {
      const followUpLines = rec.suggestedFollowUp
        .split('\n')
        .map(l => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(l => l.length > 12);

      followUpLines.forEach((fLine, fIdx) => {
        if (list.length < 10 && !list.some(item => item.question === fLine)) {
          const isRealQuestion = fLine.includes('?');
          const formulated = isRealQuestion 
            ? fLine 
            : `Follow-up from "${topic || 'our last lesson'}": ${fLine}`;

          list.push({
            id: `pl-fu-${rIdx}-${fIdx}`,
            question: formulated,
            category: 'past_lessons',
            sourceTag: `Follow-up (${dateFormatted})`,
            followUpHint: topic ? `Nawiązanie do tematu: ${topic}` : undefined
          });
        }
      });
    }

    // 2. Z kluczowych słówek (Words & Phrases / vocabularyText)
    const wordsRaw = (rec as any).words || rec.vocabularyText;
    if (wordsRaw && wordsRaw.trim().length > 3 && list.length < 10) {
      const wordsList = wordsRaw
        .split(/[\n,;]+/)
        .map((w: string) => w.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((w: string) => w.length > 2 && !w.toLowerCase().includes('brak'));

      if (wordsList.length > 0) {
        // Wybierz słowo
        const pickedWord = wordsList[0];
        const wordQuestion = `Recall challenge: Use the phrase "${pickedWord}" from our lesson on "${topic || 'vocabulary'}" in a real sentence about your day.`;

        if (!list.some(item => item.question === wordQuestion)) {
          list.push({
            id: `pl-word-${rIdx}`,
            question: wordQuestion,
            category: 'past_lessons',
            sourceTag: `Słówko: ${pickedWord}`,
            relatedWord: pickedWord
          });
        }
      }
    }

    // 3. Z punktów do poprawy (Things to improve / Accuracy)
    if (rec.thingsToImprove && rec.thingsToImprove.trim().length > 8 && list.length < 10) {
      const improvePoint = rec.thingsToImprove.split('\n')[0].replace(/^[-*•\d.)\s]+/, '').trim();
      if (improvePoint && !improvePoint.toLowerCase().includes('brak')) {
        const accuracyQuestion = `Accuracy check from "${topic || 'previous session'}": How would you express this correctly in English: "${improvePoint.slice(0, 90)}"?`;

        if (!list.some(item => item.question === accuracyQuestion)) {
          list.push({
            id: `pl-improve-${rIdx}`,
            question: accuracyQuestion,
            category: 'past_lessons',
            sourceTag: `Korekta (${dateFormatted})`,
            followUpHint: 'Zwróć uwagę na poprawną strukturę i czasy gramatyczne.'
          });
        }
      }
    }

    // 4. Z tematu lekcji (Discussion continuation)
    if (topic && topic.length > 4 && list.length < 10) {
      const topicQuestion = `Since our lesson on "${topic}": Have you encountered a situation where you had to use this in practice? Tell me briefly what happened.`;

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

  // Uzupełnij do minimum 6 pytań
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

  return list.slice(0, 10);
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
    const aiRes = await generateLessonPlannerAI({
      prompt,
      systemInstruction: 'You are an elite ESL conversation coach crafting engaging warm-up questions. Return valid JSON only.',
      jsonMode: true
    });
    const jsonStr = extractJSON(aiRes.text);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 10).map((item: any, idx: number) => ({
        id: `ai-wq-${Date.now()}-${idx}`,
        question: item.question,
        category: 'scenario' as const,
        sourceTag: item.sourceTag || 'AI Generated',
        followUpHint: item.followUpHint
      }));
    }
  } catch (err) {
    console.warn('[WheelQuestionService] AI generation failed, using fallback:', err);
  }

  return FALLBACK_WARMUP_QUESTIONS;
}
