import { 
  LessonPresentation, 
  PresentationSlide, 
  PresentationSlideItem,
  GeneratedLessonScenario, 
  LessonRecord,
  LiveCorrectionItem,
  LiveVocabItem
} from '../types';
import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { generateLessonPlannerAI, extractJSON } from './geminiService';
import { 
  OPENAI_LUNA_MODEL_NAME, 
  SYSTEM_PROMPT_OPENAI_LUNA, 
  buildDeckGenerationPrompt,
  buildSingleSlidePrompt,
  buildEnhanceSlidePrompt
} from './presentationGuidelines';

const LOCAL_STORAGE_PRESENTATIONS_KEY = 'cribro_saved_presentations_v1';

export const getDefaultPresentation = (
  studentId?: string | null, 
  studentName?: string | null, 
  level: string = 'B2'
): LessonPresentation => {
  const defaultSlides: PresentationSlide[] = [
    {
      id: 'slide-1',
      type: 'title',
      title: 'Mastering Professional Discussions & Expressing Nuance',
      subtitle: `Lekcja konwersacyjna • Poziom ${level} • ${studentName ? `Dla: ${studentName}` : 'Panel Nauczyciela'}`,
      content: 'Współczesne techniki argumentacji, dyplomatyczny język biznesowy oraz zaawansowane zwroty reakcyjne.',
      timerMinutes: 60,
      speakerNotes: 'Wprowadź cel lekcji: płynne przedstawianie opinii i dyplomatyczne nie zgadzanie się.',
      bgTheme: 'emerald'
    },
    {
      id: 'slide-2',
      type: 'warmup',
      title: 'Warm-up & Icebreaker',
      subtitle: 'Krótka rozgrzewka konwersacyjna (5-8 min)',
      items: [
        {
          id: 'q-1',
          question: 'How do you handle situations when you completely disagree with a colleague or client without creating tension?'
        },
        {
          id: 'q-2',
          question: 'Have you ever had to soften bad news in a professional meeting? What phrases did you use?'
        },
        {
          id: 'q-3',
          question: 'Which is more important in leadership: radical candour (100% directness) or diplomatic tact?'
        }
      ],
      timerMinutes: 8,
      speakerNotes: 'Zachęć kursanta do podania konkretnego przykładu z życia zawodowego.',
      bgTheme: 'dark'
    },
    {
      id: 'slide-3',
      type: 'vocabulary',
      title: 'Key Vocabulary & Diplomatic Phrasing',
      subtitle: 'Kluczowe zwroty do aktywnego użycia w dyskusji',
      items: [
        {
          id: 'v-1',
          term: 'With all due respect...',
          ipa: '/wɪð ɔːl djuː rɪˈspɛkt/',
          definition: 'Z całym szacunkiem (klasyczny zwrot wprowadzający odmienną perspektywę)',
          example: 'With all due respect, I believe we might be overlooking the long-term maintenance costs.'
        },
        {
          id: 'v-2',
          term: 'To play devil\'s advocate',
          ipa: '/pleɪ ˈdɛvlz ˈædvəkət/',
          definition: 'Być adwokatem diabła / przedstawiać kontrargument dla przetestowania pomysłu',
          example: 'Just to play devil\'s advocate for a moment: what happens if the launch is delayed by a month?'
        },
        {
          id: 'v-3',
          term: 'To soften the blow',
          ipa: '/ˈsɒfn ðə bləʊ/',
          definition: 'Złagodzić cios / przekazać trudną wiadomość w łagodniejszy sposób',
          example: 'The manager tried to soften the blow by praising our effort before announcing the budget cuts.'
        },
        {
          id: 'v-4',
          term: 'I see where you\'re coming from, but...',
          ipa: '/aɪ siː weər jʊər ˈkʌmɪŋ frɒm/',
          definition: 'Rozumiem twój punkt widzenia, ale...',
          example: 'I see where you\'re coming from, but let\'s look at what the latest data actually shows.'
        }
      ],
      timerMinutes: 12,
      speakerNotes: 'Odsłuchajcie wymowę każdego zwrotu. Poproś kursanta o ułożenie 1 własnego zdania z wybranym zwrotem.',
      bgTheme: 'midnight'
    },
    {
      id: 'slide-4',
      type: 'grammar',
      title: 'Hedging & Softening Language Formula',
      subtitle: 'Techniki łagodzenia twierdzeń i unikania kategoryczności',
      content: `W języku angielskim profesjonalnym rzadko mówimy: *"You are wrong"* lub *"This idea is terrible"*.
Zamiast tego stosujemy **hedging** (język asekuracyjny):

- **Modals:** *It **might** be worth considering...* (zamiast: *We must do...*)
- **Introductory phrases:** *It seems to me that...* / *I tend to think that...*
- **Negative questions:** *Wouldn't it be safer if we verified this first?*
- **Continuous forms:** *I was wondering if you could look over this...*`,
      items: [
        {
          id: 'g-1',
          errorText: 'We cannot meet this deadline.',
          correctionText: 'It might prove challenging to meet this deadline under current constraints.',
          explanation: 'Użycie "might prove challenging" zamiast twardego "cannot"'
        },
        {
          id: 'g-2',
          errorText: 'Your report is incomplete.',
          correctionText: 'It seems there are a couple of points that could be expanded further.',
          explanation: 'Skupienie na możliwości rozbudowy raportu zamiast bezpośredniego zarzutu braku'
        }
      ],
      timerMinutes: 10,
      speakerNotes: 'Przećwiczcie przekształcanie bezpośrednich zdań na dyplomatyczne.',
      bgTheme: 'dark'
    },
    {
      id: 'slide-5',
      type: 'practice',
      title: 'Interactive Case Study & Live Drill',
      subtitle: 'Mini symulacja: Przekonaj zespół do zmiany strategii',
      content: 'Jesteś na spotkaniu strategicznym. Twój zespół chce przeznaczyć 80% budżetu na tradycyjny marketing. Ty chcesz zainwestować w content & AI automations.',
      items: [
        {
          id: 'p-1',
          question: 'Krok 1: Wprowadź swoją wątpliwość bez atakowania obecnego planu.',
          hint: 'Użyj: "I see where you\'re coming from, however..." lub "Just to play devil\'s advocate..."',
          answer: 'I see where you\'re coming from regarding traditional channels, but wouldn\'t it be worth allocating a portion to AI automations?',
          revealed: false
        },
        {
          id: 'p-2',
          question: 'Krok 2: Odpowiedz na kontrargument szefa: "AI is too risky right now".',
          hint: 'Użyj: "With all due respect..." lub "I tend to believe that..."',
          answer: 'With all due respect, the real risk might actually be falling behind competitors who are already scaling their workflows.',
          revealed: false
        }
      ],
      timerMinutes: 15,
      speakerNotes: 'Odegrajcie scenkę w rolach: Nauczyciel = sceptyczny szef, Kursant = dyplomatyczny strateg.',
      bgTheme: 'midnight'
    },
    {
      id: 'slide-6',
      type: 'summary',
      title: 'Lesson Wrap-up & Actionable Notes',
      subtitle: 'Podsumowanie kluczowych wniosków z zajęć',
      content: `### 🎯 Główne osiągnięcia dzisiejszej lekcji:
- Przećwiczono 4 zaawansowane zwroty dyplomatyczne
- Zastosowano techniki *hedgingu* w symulacji biznesowej
- Wyeliminowano kategoryczne twierdzenia na rzecz profesjonalnej perswazji

### 📝 Rekomendacja na kolejną lekcję:
- Przygotować 3-minutowy pitch z użyciem zwrotów: *play devil's advocate*, *with all due respect*, *it might be worth considering*.`,
      timerMinutes: 5,
      speakerNotes: 'Przeprowadź krótką autorefleksję z kursantem i zapisz notatkę końcową.',
      bgTheme: 'emerald'
    }
  ];

  return {
    id: `pres-${Date.now()}`,
    title: 'Mastering Professional Discussions & Nuance',
    topic: 'Professional Discussions & Diplomatic Phrasing',
    targetLevel: level,
    studentId: studentId || null,
    studentName: studentName || null,
    slides: defaultSlides,
    liveCorrections: [
      {
        id: 'lc-1',
        studentSaid: 'I think that this is bad idea.',
        betterWay: 'I\'m not entirely convinced this is the most optimal approach.',
        explanation: 'Bardziej dyplomatyczny wydźwięk w komunikacji biznesowej',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ],
    liveVocab: [
      {
        id: 'lv-1',
        term: 'play devil\'s advocate',
        translation: 'być adwokatem diabła / kwestionować dla testu',
        example: 'Let me play devil\'s advocate here...',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ],
    liveNotes: `## Notatki ze wspólnej lekcji
- **Główny cel**: Dyplomatyczna argumentacja w rozmowach zespołowych
- **Akcent**: Płynność przejść między argumentami (*Moving on to...*, *Having said that...*)
- **Wymowa**: *devil's* /ˈdɛvlz/, *advocate* /ˈædvəkət/`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const createPresentationFromScenario = (
  scenario: GeneratedLessonScenario,
  studentId?: string | null,
  studentName?: string | null
): LessonPresentation => {
  const slides: PresentationSlide[] = [];

  // 1. Title Slide
  slides.push({
    id: `slide-title-${Date.now()}`,
    type: 'title',
    title: scenario.topic || scenario.title,
    subtitle: `Scenariusz lekcji • Poziom ${scenario.targetLevel || 'B2'} • Czas: ${scenario.lessonDuration || '60 min'}`,
    content: `Interaktywna prezentacja przygotowana na podstawie konspektu lekcji dla ${studentName || 'kursanta'}.`,
    timerMinutes: 60,
    speakerNotes: `Cel lekcji: ${scenario.topic}`,
    bgTheme: 'emerald'
  });

  // Convert parsed stages or body to slides
  if (scenario.stages && scenario.stages.length > 0) {
    scenario.stages.forEach((stage, idx) => {
      let slideType: PresentationSlide['type'] = 'freeform';
      const titleLower = stage.title.toLowerCase();

      if (titleLower.includes('warm') || titleLower.includes('rozgrzewk') || titleLower.includes('lead-in')) {
        slideType = 'warmup';
      } else if (titleLower.includes('vocab') || titleLower.includes('słown') || titleLower.includes('zwrot')) {
        slideType = 'vocabulary';
      } else if (titleLower.includes('gramm') || titleLower.includes('strukt') || titleLower.includes('wzorzec')) {
        slideType = 'grammar';
      } else if (titleLower.includes('pract') || titleLower.includes('ćwicz') || titleLower.includes('drill') || titleLower.includes('zadan')) {
        slideType = 'practice';
      } else if (titleLower.includes('speak') || titleLower.includes('dysk') || titleLower.includes('rozmow')) {
        slideType = 'speaking';
      } else if (titleLower.includes('homew') || titleLower.includes('podsum') || titleLower.includes('wrap')) {
        slideType = 'summary';
      }

      // Parse bullet points or sentences from stage body
      const lines = stage.body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const items: PresentationSlide['items'] = [];

      lines.forEach((line, lineIdx) => {
        const cleanLine = line.replace(/^[-*•\d.)\s]+/, '').trim();
        if (!cleanLine) return;

        if (slideType === 'vocabulary') {
          let term = cleanLine;
          let def = '';
          if (cleanLine.includes(' - ')) {
            const parts = cleanLine.split(' - ');
            term = parts[0].trim();
            def = parts.slice(1).join(' - ').trim();
          } else if (cleanLine.includes(' – ')) {
            const parts = cleanLine.split(' – ');
            term = parts[0].trim();
            def = parts.slice(1).join(' – ').trim();
          } else if (cleanLine.includes(':')) {
            const parts = cleanLine.split(':');
            term = parts[0].trim();
            def = parts.slice(1).join(':').trim();
          }
          items.push({
            id: `item-${idx}-${lineIdx}`,
            term,
            definition: def
          });
        } else if (slideType === 'warmup' || slideType === 'speaking') {
          if (cleanLine.includes('?') || cleanLine.length > 15) {
            items.push({
              id: `item-${idx}-${lineIdx}`,
              question: cleanLine
            });
          }
        } else if (slideType === 'practice') {
          items.push({
            id: `item-${idx}-${lineIdx}`,
            question: cleanLine,
            hint: 'Pomyśl o zastosowaniu poznanych struktur i zwrotów',
            revealed: false
          });
        }
      });

      const durNum = parseInt(stage.duration || '10', 10) || 10;

      slides.push({
        id: `slide-stage-${idx}-${Date.now()}`,
        type: slideType,
        title: stage.title,
        subtitle: stage.duration ? `Czas trwania: ${stage.duration}` : undefined,
        content: stage.body,
        items: items.length > 0 ? items : undefined,
        timerMinutes: durNum,
        speakerNotes: `Notatka do etapu ${stage.title}`,
        bgTheme: idx % 2 === 0 ? 'midnight' : 'dark'
      });
    });
  } else {
    // If no structured stages, create standard slides from raw content
    slides.push({
      id: `slide-body-${Date.now()}`,
      type: 'freeform',
      title: 'Scenariusz i materiały lekcji',
      subtitle: 'Przebieg zajęć',
      content: scenario.content,
      timerMinutes: 45,
      bgTheme: 'midnight'
    });
  }

  // Parse vocabulary text for live vocab
  const initialLiveVocab: LiveVocabItem[] = (scenario.vocabularyText || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map((line, idx) => {
      let term = line;
      let translation = '';
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        term = parts[0].trim();
        translation = parts.slice(1).join(' - ').trim();
      } else if (line.includes(' – ')) {
        const parts = line.split(' – ');
        term = parts[0].trim();
        translation = parts.slice(1).join(' – ').trim();
      }
      return {
        id: `lv-sc-${idx}`,
        term,
        translation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

  return {
    id: `pres-${Date.now()}`,
    title: scenario.topic || scenario.title || 'Prezentacja lekcji',
    topic: scenario.topic || scenario.title || 'Lekcja konwersacyjna',
    targetLevel: scenario.targetLevel || 'B2',
    studentId: studentId || scenario.studentId || null,
    studentName: studentName || scenario.studentName || null,
    slides,
    liveCorrections: [],
    liveVocab: initialLiveVocab,
    liveNotes: `## Notatnik do lekcji: ${scenario.topic || scenario.title}\n- Konspekt zaimportowany ze scenariusza AI.`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const createPresentationFromLessonRecord = (
  record: LessonRecord,
  studentId?: string | null,
  studentName?: string | null
): LessonPresentation => {
  const slides: PresentationSlide[] = [
    {
      id: `slide-rev-title-${Date.now()}`,
      type: 'title',
      title: `Powtórka & Przegląd: ${record.topic}`,
      subtitle: `Data lekcji: ${record.date} • Kursant: ${studentName || 'Uczeń'}`,
      content: 'Slajdy powtórkowe wygenerowane z notatek przeprowadzonej lekcji.',
      timerMinutes: 45,
      bgTheme: 'emerald'
    }
  ];

  if (record.lessonSummary) {
    slides.push({
      id: `slide-rev-summary-${Date.now()}`,
      type: 'summary',
      title: 'Revision Notes (Podsumowanie lekcji)',
      subtitle: 'Zagadnienia omówione na poprzednich zajęciach',
      content: record.lessonSummary,
      timerMinutes: 10,
      bgTheme: 'midnight'
    });
  }

  if (record.vocabularyText) {
    const vocabItems: PresentationSlideItem[] = record.vocabularyText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map((l, idx) => {
        let term = l;
        let def = '';
        if (l.includes(' - ')) {
          const parts = l.split(' - ');
          term = parts[0].trim();
          def = parts.slice(1).join(' - ').trim();
        } else if (l.includes(' – ')) {
          const parts = l.split(' – ');
          term = parts[0].trim();
          def = parts.slice(1).join(' – ').trim();
        }
        return {
          id: `rev-v-${idx}`,
          term,
          definition: def
        };
      });

    slides.push({
      id: `slide-rev-vocab-${Date.now()}`,
      type: 'vocabulary',
      title: 'Słownictwo z lekcji (Vocabulary Check)',
      subtitle: 'Zwroty i słówka wprowadzone podczas zajęć',
      items: vocabItems,
      timerMinutes: 15,
      bgTheme: 'dark'
    });
  }

  if (record.thingsToImprove) {
    slides.push({
      id: `slide-rev-improve-${Date.now()}`,
      type: 'correction',
      title: 'Things to Improve (Kwestie do dopracowania)',
      subtitle: 'Błędy, wymowa i struktury do utrwalenia',
      content: record.thingsToImprove,
      timerMinutes: 10,
      bgTheme: 'midnight'
    });
  }

  if (record.suggestedFollowUp) {
    slides.push({
      id: `slide-rev-followup-${Date.now()}`,
      type: 'practice',
      title: 'Zadania & Kolejne kroki (Follow-up)',
      subtitle: 'Rekomendowane ćwiczenia i zadania',
      content: record.suggestedFollowUp,
      timerMinutes: 10,
      bgTheme: 'emerald'
    });
  }

  return {
    id: `pres-rec-${Date.now()}`,
    title: `Powtórka: ${record.topic}`,
    topic: record.topic,
    targetLevel: 'B2',
    studentId: studentId || record.studentId || null,
    studentName: studentName || null,
    slides,
    liveCorrections: [],
    liveVocab: [],
    liveNotes: `## Notatnik powtórkowy do lekcji: ${record.topic}\n- Lekcja z dnia: ${record.date}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const generateAIPresentationDeck = async ({
  topic,
  level = 'B2',
  studentId,
  studentName,
  focusArea = 'Konwersacje, naturalne kolokacje i praktyka',
  thingsToImprove,
  customInstructions,
  lessonStyle = 'celta-standard'
}: {
  topic: string;
  level?: string;
  studentId?: string;
  studentName?: string;
  focusArea?: string;
  thingsToImprove?: string;
  customInstructions?: string;
  lessonStyle?: 'celta-standard' | 'practice-intensive' | 'business-speaking' | 'grammar-drills';
}): Promise<LessonPresentation> => {
  const prompt = buildDeckGenerationPrompt({
    topic,
    level,
    studentName,
    focusArea,
    thingsToImprove,
    customInstructions,
    lessonStyle
  });

  const res = await generateLessonPlannerAI({
    prompt,
    systemInstruction: SYSTEM_PROMPT_OPENAI_LUNA,
    preferredModels: [
      OPENAI_LUNA_MODEL_NAME,
      'openai/gpt-4o-mini',
      'gemini-3.7-flash',
      'gemini-2.5-flash'
    ]
  });

  const jsonStr = extractJSON(res.text);
  const parsed = JSON.parse(jsonStr);

  const slides: PresentationSlide[] = (parsed.slides || []).map((s: any, idx: number) => ({
    id: s.id || `slide-${idx + 1}-${Date.now()}`,
    type: s.type || (idx === (parsed.slides?.length || 1) - 1 ? 'enclosure' : 'freeform'),
    title: s.title || `Slajd ${idx + 1}`,
    subtitle: s.subtitle || '',
    content: s.content || '',
    items: (s.items || []).map((it: any, itemIdx: number) => ({
      id: it.id || `item-${idx + 1}-${itemIdx + 1}-${Date.now()}`,
      term: it.term || '',
      ipa: it.ipa || '',
      definition: it.definition || '',
      example: it.example || '',
      question: it.question || '',
      errorText: it.errorText || '',
      correctionText: it.correctionText || '',
      explanation: it.explanation || '',
      hint: it.hint || '',
      answer: it.answer || '',
      revealed: it.revealed || false,
      exerciseType: it.exerciseType,
      options: it.options,
      correctOptionIndex: it.correctOptionIndex,
      roleUser: it.roleUser,
      roleTeacher: it.roleTeacher,
      scenarioContext: it.scenarioContext,
      taskGoal: it.taskGoal
    })),
    quickCheck: Array.isArray(s.quickCheck) ? s.quickCheck : undefined,
    exitTicketChallenge: s.exitTicketChallenge || undefined,
    timerMinutes: s.timerMinutes || 10,
    speakerNotes: s.speakerNotes || '',
    bgTheme: s.bgTheme || (s.type === 'enclosure' || s.type === 'title' ? 'emerald' : s.type === 'vocabulary' || s.type === 'practice' ? 'midnight' : 'dark'),
    aiModelUsed: 'OpenAI 5.6 Luna'
  }));

  return {
    id: `pres-${Date.now()}`,
    title: parsed.title || topic,
    topic: parsed.topic || topic,
    targetLevel: parsed.targetLevel || level,
    studentId: studentId || null,
    studentName: studentName || null,
    slides,
    liveCorrections: [],
    liveVocab: [],
    liveNotes: `## Notatnik lekcyjny: ${parsed.title || topic}\n- Wygenerowano z silnikiem OpenAI 5.6 Luna dla poziomu ${level}.\n- Styl lekcji: ${lessonStyle}`,
    aiModelUsed: 'OpenAI 5.6 Luna',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

/**
 * Generuje pojedynczy nowy slajd (np. Practice, Enclosure, Warm-up) z modelem OpenAI 5.6 Luna
 */
export const generateAISingleSlide = async ({
  topic,
  level = 'B2',
  slideType,
  customPrompt
}: {
  topic: string;
  level?: string;
  slideType: string;
  customPrompt?: string;
}): Promise<PresentationSlide> => {
  const prompt = buildSingleSlidePrompt({
    topic,
    level,
    slideType,
    customPrompt
  });

  const res = await generateLessonPlannerAI({
    prompt,
    systemInstruction: SYSTEM_PROMPT_OPENAI_LUNA,
    preferredModels: [
      OPENAI_LUNA_MODEL_NAME,
      'openai/gpt-4o-mini',
      'gemini-3.7-flash',
      'gemini-2.5-flash'
    ]
  });

  const jsonStr = extractJSON(res.text);
  const s = JSON.parse(jsonStr);

  return {
    id: s.id || `slide-${Date.now()}`,
    type: s.type || slideType || 'practice',
    title: s.title || `Ćwiczenie: ${topic}`,
    subtitle: s.subtitle || '',
    content: s.content || '',
    items: (s.items || []).map((it: any, itemIdx: number) => ({
      id: it.id || `item-${itemIdx + 1}-${Date.now()}`,
      term: it.term || '',
      ipa: it.ipa || '',
      definition: it.definition || '',
      example: it.example || '',
      question: it.question || '',
      errorText: it.errorText || '',
      correctionText: it.correctionText || '',
      explanation: it.explanation || '',
      hint: it.hint || '',
      answer: it.answer || '',
      revealed: it.revealed || false,
      exerciseType: it.exerciseType,
      options: it.options,
      correctOptionIndex: it.correctOptionIndex,
      roleUser: it.roleUser,
      roleTeacher: it.roleTeacher,
      scenarioContext: it.scenarioContext,
      taskGoal: it.taskGoal
    })),
    quickCheck: Array.isArray(s.quickCheck) ? s.quickCheck : undefined,
    exitTicketChallenge: s.exitTicketChallenge || undefined,
    timerMinutes: s.timerMinutes || 10,
    speakerNotes: s.speakerNotes || 'Wskazówka dydaktyczna OpenAI 5.6 Luna',
    bgTheme: s.bgTheme || (slideType === 'enclosure' ? 'emerald' : slideType === 'practice' ? 'midnight' : 'dark'),
    aiModelUsed: 'OpenAI 5.6 Luna'
  };
};

/**
 * Ulepsza / przebudowuje istniejący slajd przy pomocy OpenAI 5.6 Luna
 */
export const enhanceAISlide = async ({
  slide,
  instruction,
  level = 'B2'
}: {
  slide: PresentationSlide;
  instruction: string;
  level?: string;
}): Promise<PresentationSlide> => {
  const prompt = buildEnhanceSlidePrompt({
    slide,
    instruction,
    level
  });

  const res = await generateLessonPlannerAI({
    prompt,
    systemInstruction: SYSTEM_PROMPT_OPENAI_LUNA,
    preferredModels: [
      OPENAI_LUNA_MODEL_NAME,
      'openai/gpt-4o-mini',
      'gemini-3.7-flash',
      'gemini-2.5-flash'
    ]
  });

  const jsonStr = extractJSON(res.text);
  const s = JSON.parse(jsonStr);

  return {
    ...slide,
    title: s.title || slide.title,
    subtitle: s.subtitle !== undefined ? s.subtitle : slide.subtitle,
    content: s.content !== undefined ? s.content : slide.content,
    items: Array.isArray(s.items) ? s.items.map((it: any, itemIdx: number) => ({
      id: it.id || `item-${itemIdx + 1}-${Date.now()}`,
      term: it.term || '',
      ipa: it.ipa || '',
      definition: it.definition || '',
      example: it.example || '',
      question: it.question || '',
      errorText: it.errorText || '',
      correctionText: it.correctionText || '',
      explanation: it.explanation || '',
      hint: it.hint || '',
      answer: it.answer || '',
      revealed: it.revealed || false,
      exerciseType: it.exerciseType,
      options: it.options,
      correctOptionIndex: it.correctOptionIndex,
      roleUser: it.roleUser,
      roleTeacher: it.roleTeacher,
      scenarioContext: it.scenarioContext,
      taskGoal: it.taskGoal
    })) : slide.items,
    quickCheck: Array.isArray(s.quickCheck) ? s.quickCheck : slide.quickCheck,
    exitTicketChallenge: s.exitTicketChallenge || slide.exitTicketChallenge,
    speakerNotes: s.speakerNotes || slide.speakerNotes,
    aiModelUsed: 'OpenAI 5.6 Luna'
  };
};

export const savePresentationToStorage = async (presentation: LessonPresentation): Promise<void> => {
  try {
    const updated = {
      ...presentation,
      updatedAt: new Date().toISOString()
    };

    // Save to LocalStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_PRESENTATIONS_KEY);
      const list: LessonPresentation[] = stored ? JSON.parse(stored) : [];
      const filtered = list.filter(p => p.id !== updated.id);
      filtered.unshift(updated);
      localStorage.setItem(LOCAL_STORAGE_PRESENTATIONS_KEY, JSON.stringify(filtered.slice(0, 50)));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // Save to Firestore
    if (presentation.studentId) {
      const presRef = doc(db, `users/${presentation.studentId}/presentations`, presentation.id);
      await setDoc(presRef, updated, { merge: true });
    } else {
      const presRef = doc(db, 'globalPresentations', presentation.id);
      await setDoc(presRef, updated, { merge: true });
    }
  } catch (err) {
    console.error('Error saving presentation:', err);
  }
};

export const getSavedPresentationsList = async (studentId?: string | null): Promise<LessonPresentation[]> => {
  const result: LessonPresentation[] = [];

  // Load from local storage first
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_PRESENTATIONS_KEY);
    if (stored) {
      const list: LessonPresentation[] = JSON.parse(stored);
      result.push(...list);
    }
  } catch (e) {
    console.warn('LocalStorage load error:', e);
  }

  // Load from Firestore if online
  try {
    if (studentId) {
      const snap = await getDocs(collection(db, `users/${studentId}/presentations`));
      snap.forEach(docSnap => {
        const data = docSnap.data() as LessonPresentation;
        if (!result.find(p => p.id === data.id)) {
          result.push(data);
        }
      });
    } else {
      const snap = await getDocs(collection(db, 'globalPresentations'));
      snap.forEach(docSnap => {
        const data = docSnap.data() as LessonPresentation;
        if (!result.find(p => p.id === data.id)) {
          result.push(data);
        }
      });
    }
  } catch (err) {
    console.warn('Firestore load presentations error (falling back to local):', err);
  }

  // Filter if studentId specified
  if (studentId) {
    return result.filter(p => !p.studentId || p.studentId === studentId);
  }
  return result;
};

export const deleteSavedPresentation = async (id: string, studentId?: string | null): Promise<void> => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_PRESENTATIONS_KEY);
    if (stored) {
      const list: LessonPresentation[] = JSON.parse(stored);
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem(LOCAL_STORAGE_PRESENTATIONS_KEY, JSON.stringify(filtered));
    }

    if (studentId) {
      await deleteDoc(doc(db, `users/${studentId}/presentations`, id));
    } else {
      await deleteDoc(doc(db, 'globalPresentations', id));
    }
  } catch (err) {
    console.warn('Error deleting presentation:', err);
  }
};
