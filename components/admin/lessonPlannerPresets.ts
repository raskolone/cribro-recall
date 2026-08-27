import { LessonModuleConfig, LessonPlanPreset } from '../../types';

export const DEFAULT_LESSON_MODULES: LessonModuleConfig[] = [
  {
    id: 'mod-1-warmup',
    order: 1,
    title: '1. Revision and Warm Up (15–20 min)',
    duration: '15–20 min',
    placeholderInstruction: 'Powtórka słownictwa i zagadnień z poprzedniej lekcji. 3–4 angażujące pytania rozgrzewkowe wprowadzające w temat przewodni zajęć.',
    enabled: true,
    isCustom: false
  },
  {
    id: 'mod-2-main-topic',
    order: 2,
    title: '2. Main Topic (25–30 min)',
    duration: '25–30 min',
    placeholderInstruction: 'Główna oś dyskusyjna lekcji: analiza tematu, case study, pytania otwarte rozwijające płynność wypowiedzi i argumentację.',
    enabled: true,
    isCustom: false
  },
  {
    id: 'mod-3-language-focus',
    order: 3,
    title: '3. Language Focus (10 min)',
    duration: '10 min',
    placeholderInstruction: 'Zestaw 6–10 kluczowych zwrotów, kolokacji lub struktur z polskimi odpowiednikami i przykładami użycia w kontekście tematu.',
    enabled: true,
    isCustom: false
  },
  {
    id: 'mod-4-practice',
    order: 4,
    title: '4. Practice Enclosure (10 min)',
    duration: '10 min',
    placeholderInstruction: 'Ćwiczenie utrwalające w praktyce: dynamiczny role-play, mini-debata, sytuacja problemowa lub reakcje językowe.',
    enabled: true,
    isCustom: false
  },
  {
    id: 'mod-5-homework',
    order: 5,
    title: '5. Homework — Translation PL→EN',
    duration: 'Zadanie domowe',
    placeholderInstruction: '5–8 praktycznych zdań po polsku do przetłumaczenia na język angielski, bezpośrednio sprawdzających zwroty z tej lekcji.',
    enabled: true,
    isCustom: false
  }
];

export const SAMPLE_MODULES_CATALOG: Omit<LessonModuleConfig, 'id' | 'order' | 'enabled'>[] = [
  {
    title: 'Revision & Error Clinic (10–15 min)',
    duration: '10–15 min',
    placeholderInstruction: 'Analiza typowych błędów kursanta z ostatnich zajęć, poprawa zdań oraz powtórka trudnych zwrotów.',
    isCustom: false
  },
  {
    title: 'Icebreaker & Small Talk (5–10 min)',
    duration: '5–10 min',
    placeholderInstruction: 'Lekkie, naturalne pytania wprowadzające i budujące swobodę mówienia po angielsku.',
    isCustom: false
  },
  {
    title: 'Grammar in Context & Drills (15–20 min)',
    duration: '15–20 min',
    placeholderInstruction: 'Zwięzłe omówienie reguły gramatycznej na żywych przykładach oraz 5 ćwiczeń transformacyjnych.',
    isCustom: false
  },
  {
    title: 'Business Simulation & Role-Play (20 min)',
    duration: '20 min',
    placeholderInstruction: 'Realistyczny scenariusz biznesowy (np. negocjacje, spotkanie z klientem, rozwiązywanie kryzysu) z rolami dla lektora i kursanta.',
    isCustom: false
  },
  {
    title: 'Article / Case Study Discussion (20–25 min)',
    duration: '20–25 min',
    placeholderInstruction: 'Krótki zarys sytuacji lub fragment artykułu wraz z 6 pytaniami prowokującymi do pogłębionej dyskusji.',
    isCustom: false
  },
  {
    title: 'Idioms & Advanced Collocations (10 min)',
    duration: '10 min',
    placeholderInstruction: '6 zaawansowanych idiomów lub kolokacji C1/B2 ze wskazówkami naturalnego użycia i polskim tłumaczeniem.',
    isCustom: false
  },
  {
    title: 'Writing Task & Email Draft (15 min)',
    duration: '15 min',
    placeholderInstruction: 'Zadanie pisemne: przygotowanie profesjonalnego maila lub notatki biznesowej z szablonem zwrotów.',
    isCustom: false
  },
  {
    title: 'Pronunciation & Accent Workshop (10 min)',
    duration: '10 min',
    placeholderInstruction: 'Ćwiczenia fonetyczne: intonacja, linked speech oraz najczęściej mylone głoski w języku angielskim.',
    isCustom: false
  }
];

export const LESSON_PRESETS: LessonPlanPreset[] = [
  {
    id: 'preset-standard',
    name: 'Wzór standardowy (ze zdjęcia)',
    description: 'Klasyczny układ 5-modułowy: Warm-up → Main Topic → Language Focus → Practice → Homework PL→EN',
    defaultDuration: '60 min',
    modules: DEFAULT_LESSON_MODULES
  },
  {
    id: 'preset-conversational',
    name: 'Konwersacje i Płynność (50 min)',
    description: 'Skupienie na mówieniu: Small Talk → Case Discussion → Idioms → Debate → Homework',
    defaultDuration: '50 min',
    modules: [
      {
        id: 'c-1',
        order: 1,
        title: '1. Small Talk & Icebreaker (10 min)',
        duration: '10 min',
        placeholderInstruction: 'Pytania rozgrzewkowe z życia codziennego i luźne wprowadzenie do głównego tematu.',
        enabled: true
      },
      {
        id: 'c-2',
        order: 2,
        title: '2. Deep Dive Discussion (25 min)',
        duration: '25 min',
        placeholderInstruction: 'Zestaw 6–8 pogłębionych pytań problemowych i dylematów moralnych/biznesowych do dyskusji.',
        enabled: true
      },
      {
        id: 'c-3',
        order: 3,
        title: '3. Expressive Vocabulary (10 min)',
        duration: '10 min',
        placeholderInstruction: 'Zwroty wyrażające opinię, niuansowanie i naturalne wtrącenia językowe z polskim tłumaczeniem.',
        enabled: true
      },
      {
        id: 'c-4',
        order: 4,
        title: '4. Mini-Debate / Argumentation (10 min)',
        duration: '10 min',
        placeholderInstruction: 'Krótka debata: kursant i lektor bronią przeciwstawnych stanowisk.',
        enabled: true
      },
      {
        id: 'c-5',
        order: 5,
        title: '5. Homework — Discussion Audio/Text Task',
        duration: 'Zadanie domowe',
        placeholderInstruction: 'Przygotowanie 1–2 minutowej wypowiedzi ustnej lub 5 zdań z nowymi zwrotami.',
        enabled: true
      }
    ]
  },
  {
    id: 'preset-business',
    name: 'Business English & Case Study',
    description: 'Biznesowy: Warm-up → Business Scenario → Negotiations → Professional Vocab → Task',
    defaultDuration: '60 min',
    modules: [
      {
        id: 'b-1',
        order: 1,
        title: '1. Business Warm-up & Current Affairs (10 min)',
        duration: '10 min',
        placeholderInstruction: 'Wprowadzenie w kontekst rynkowy lub bieżące wyzwania w pracy kursanta.',
        enabled: true
      },
      {
        id: 'b-2',
        order: 2,
        title: '2. Business Case Study & Problem Solving (25 min)',
        duration: '25 min',
        placeholderInstruction: 'Konkretny przypadek biznesowy z problemem do rozwiązania i analizą opcji.',
        enabled: true
      },
      {
        id: 'b-3',
        order: 3,
        title: '3. Corporate & Negotiation Lexicon (15 min)',
        duration: '15 min',
        placeholderInstruction: 'Zwroty dyplomatyczne, formalne kolokacje i słownictwo negocjacyjne (PL → EN).',
        enabled: true
      },
      {
        id: 'b-4',
        order: 4,
        title: '4. Executive Role-Play Simulation (10 min)',
        duration: '10 min',
        placeholderInstruction: 'Symulacja rozmowy z trudnym klientem lub partnerem biznesowym.',
        enabled: true
      },
      {
        id: 'b-5',
        order: 5,
        title: '5. Homework — Professional Email & Translation',
        duration: 'Zadanie domowe',
        placeholderInstruction: 'Napisanie maila podsumowującego ustalenia oraz 5 zdań tłumaczeniowych PL→EN.',
        enabled: true
      }
    ]
  },
  {
    id: 'preset-grammar',
    name: 'Gramatyka w kontekście',
    description: 'Metodyczny: Lead-in → Guided Discovery → Controlled Drills → Free Practice → Homework',
    defaultDuration: '50 min',
    modules: [
      {
        id: 'g-1',
        order: 1,
        title: '1. Contextual Warm-up (10 min)',
        duration: '10 min',
        placeholderInstruction: 'Rozmowa naturalnie prowokująca potrzebę użycia docelowej struktury gramatycznej.',
        enabled: true
      },
      {
        id: 'g-2',
        order: 2,
        title: '2. Grammar Rules & Model Sentences (15 min)',
        duration: '15 min',
        placeholderInstruction: 'Klarowne wyjaśnienie zasady po polsku, schemat budowy i 6 reprezentatywnych przykładów.',
        enabled: true
      },
      {
        id: 'g-3',
        order: 3,
        title: '3. Controlled Practice & Transformations (15 min)',
        duration: '15 min',
        placeholderInstruction: 'Ćwiczenia transformacyjne, uzupełnianie luk i poprawianie typowych błędów.',
        enabled: true
      },
      {
        id: 'g-4',
        order: 4,
        title: '4. Free Conversational Practice (10 min)',
        duration: '10 min',
        placeholderInstruction: 'Pytania do rozmowy wymagające spontanicznego zastosowania nowej gramatyki.',
        enabled: true
      },
      {
        id: 'g-5',
        order: 5,
        title: '5. Homework — Translation PL→EN (Grammar Focus)',
        duration: 'Zadanie domowe',
        placeholderInstruction: '8 zdań po polsku do przetłumaczenia na język angielski z naciskiem na nową strukturę.',
        enabled: true
      }
    ]
  }
];
