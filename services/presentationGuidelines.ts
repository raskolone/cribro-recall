/**
 * Dydaktyczne wytyczne tworzenia formy prezentacji oraz interaktywnych ćwiczeń (Practice & Enclosure)
 * dedykowane dla silnika OpenAI 5.6 Luna.
 * 
 * Standard metodyczny oparty o ramy CELTA / ESA (Engage -> Study -> Activate)
 * oraz model konsolidacji pamięciowej Recall.
 */

export interface PresentationGuidelineSection {
  id: string;
  title: string;
  badge: string;
  description: string;
  keyPrinciples: string[];
  slideTypes: string[];
  exampleStructure: string;
}

export const OPENAI_LUNA_MODEL_NAME = 'openai/gpt-5.6-luna';
export const OPENAI_LUNA_DISPLAY_NAME = 'OpenAI 5.6 Luna (Flagship Pedagogical Tier)';

export const PEDAGOGICAL_GUIDELINES: PresentationGuidelineSection[] = [
  {
    id: 'architecture',
    title: '1. Architektura Prezentacji (Struktura Lekcji)',
    badge: 'CELTA / ESA Standard',
    description: 'Slajdy muszą prowadzić kursanta od zaciekawienia tematem przez ekspozycję językową po swobodne użycie i utrwalenie.',
    keyPrinciples: [
      'Brak przeładowania tekstem (Zero Wall-of-Text): maks. 3-4 punkty/frazy na slajd z natychmiastowym kontekstem.',
      'Logiczna progresja: Lead-in (Warm-up) → Target Language (Vocab/Grammar) → Guided Practice → Free Practice (Speaking/Role-play) → Enclosure.',
      'Dopasowanie do poziomu CEFR kursanta (rejestr formalny, kolokacje, stopień złożoności).',
      'Każdy slajd ma przypisany czas (timerMinutes) oraz notatki metodyczne dla lektora (speakerNotes).'
    ],
    slideTypes: ['title', 'warmup', 'vocabulary', 'grammar', 'practice', 'speaking', 'enclosure'],
    exampleStructure: '6-slajdowy standard: Wprowadzenie (5m) → Warm-up (8m) → Key Vocab & IPA (12m) → Grammar in Action (10m) → Interactive Practice / Role-play (15m) → Enclosure & Exit Ticket (5m)'
  },
  {
    id: 'practice',
    title: '2. Moduł Practice (Interaktywne Ćwiczenia & Drills)',
    badge: 'Guided & Free Practice',
    description: 'Ćwiczenia interaktywne na slajdach Practice muszą aktywizować kursanta do mówienia i myślenia w języku docelowym.',
    keyPrinciples: [
      'Trójstopniowa konstrukcja zadania: Zadanie/Pytanie → Wskazówka (Hint) → Odkrywany wzorzec (Answer & TTS audio).',
      'Różnorodność formatów: luki w zdaniach (Cloze), przekształcenia (Transformations), Concept Check Questions (CCQs) oraz analiza mikrobłędów.',
      'Naturalny, żywy język (zero sztucznych zdań-klisz z podręczników lat 90.).',
      'Podział na zadania sterowane (kontrola poprawności) i zadania otwarte (płynność).'
    ],
    slideTypes: ['practice', 'grammar'],
    exampleStructure: 'Każde zadanie zawiera: { question: "...", hint: "Pamiętaj o inwersji...", answer: "...", revealed: false }'
  },
  {
    id: 'enclosure',
    title: '3. Moduł Enclosure (Podsumowanie, Konsolidacja & Exit Ticket)',
    badge: 'Enclosure & Recall Bridge',
    description: 'Slajd Enclosure zamyka lekcję sukcesem komunikacyjnym, sprawdza realizację celów i tworzy most do bazy powtórek Recall.',
    keyPrinciples: [
      'Quick Check (3 szybkie pytania sprawdzające zrozumienie kluczowych pojęć lekcji).',
      'Exit Ticket Challenge (jedno minizadanie produkcyjne, które kursant musi wykonać przed końcem lekcji).',
      'Konsolidacja leksykalna: wyróżnienie 3 najważniejszych kolokacji do utrwalenia.',
      'Płynne przejście do pracy domowej w platformie Cribro Recall.'
    ],
    slideTypes: ['enclosure', 'summary'],
    exampleStructure: 'Podsumowanie celów + 3 pytania Quick Check z odkrywanymi odpowiedziami + 1-zdaniowy Exit Ticket Challenge.'
  },
  {
    id: 'openai-luna',
    title: '4. Konfiguracja i Rola OpenAI 5.6 Luna',
    badge: 'Model Flagship AI',
    description: 'Model OpenAI 5.6 Luna działa jako wirtualny starszy metodyk (Senior CELTA Trainer & Material Developer).',
    keyPrinciples: [
      'Zaawansowane generowanie transkrypcji fonetycznej IPA dla trudnych wyrazów.',
      'Generowanie naturalnych zdań kontekstowych osadzonych w realiach dorosłych kursantów.',
      'Analiza poprzednich błędów ucznia (sekcja Things to improve) i wplatanie ich w nowe ćwiczenia Practice.',
      'Zwracanie danych w ścisłym, zwalidowanym formacie JSON zgodnym z interfejsem LessonPresentation.'
    ],
    slideTypes: ['Wszystkie slajdy'],
    exampleStructure: 'System Prompt narzucający rolę Senior CELTA Methodologist + JSON schema enforcement + TTS audio support.'
  }
];

/**
 * Główny prompt systemowy dla OpenAI 5.6 Luna
 */
export const SYSTEM_PROMPT_OPENAI_LUNA = `Jesteś OpenAI 5.6 Luna — flagowym modelem pedagogicznym i starszym metodykiem języka angielskiego (Senior CELTA/Delta Assessor & Material Designer).
Twoim zadaniem jest tworzenie najwyższej jakości, nowoczesnych, interaktywnych prezentacji dydaktycznych oraz ćwiczeń interaktywnych (Practice & Enclosure) na lekcje 1-na-1 i w małych grupach.

ŻELAZNE ZASADY METODYCZNE OPENAI 5.6 LUNA:
1. BRAK ŚCIAN TEKSTU (Zero Walls of Text): Slajdy są narzędziem do interakcji i rozmowy, a nie czytanką. Stosuj zwięzłe punkty, wyraziste przykłady i wyraźną hierarchię.
2. MODUŁ INTERAKTYWNYCH ĆWICZEŃ (Practice):
   - Każde ćwiczenie musi posiadać: pytanie/zadanie, praktyczną wskazówkę (hint) oraz wzorcową odpowiedź (answer) do odkrycia przez nauczyciela.
   - Zadania muszą bezpośrednio nawiązywać do wprowadzonego materiału i aktywizować kursanta.
3. MODUŁ ZAMKNIĘCIA (Enclosure):
   - Slajd typu 'enclosure' musi zawierać 'quickCheck' (3 szybkie pytania sprawdzające z odpowiedziami) oraz 'exitTicketChallenge' (1-minutowe zadanie końcowe).
4. WYMOWA I SŁOWNICTWO:
   - Dla kluczowych terminów ZAWSZE generuj poprawny zapis fonetyczny IPA (np. "/ˈmænɪdʒmənt/").
   - Podawaj naturalne zdania przykładowe z życia zawodowego lub codziennego.
5. DOPASOWANIE DO PROFILU KURSANTA:
   - Uwzględnij poziom CEFR, zgłoszone błędy (Things to improve) i specyfikę ucznia.
6. FORMAT WYJŚCIOWY:
   - Zwracaj WYŁĄCZNIE poprawny, zvalidowany obiekt JSON. Bez znaczników markdown ani dodatkowych komentarzy.`;

/**
 * Buduje prompt generowania pełnej talii slajdów dla OpenAI 5.6 Luna
 */
export function buildDeckGenerationPrompt({
  topic,
  level = 'B2',
  studentName,
  focusArea = 'Konwersacje, naturalne kolokacje i praktyka',
  thingsToImprove,
  customInstructions,
  lessonStyle = 'celta-standard'
}: {
  topic: string;
  level?: string;
  studentName?: string;
  focusArea?: string;
  thingsToImprove?: string;
  customInstructions?: string;
  lessonStyle?: 'celta-standard' | 'practice-intensive' | 'business-speaking' | 'grammar-drills';
}): string {
  const styleDescription = {
    'celta-standard': 'Standard CELTA/ESA: 6 zbalansowanych slajdów (Title, Warm-up, Vocab+IPA, Grammar/Structures, Interactive Practice, Enclosure & Exit Ticket).',
    'practice-intensive': 'Intensywny trening Practice: 5 slajdów skoncentrowanych na ćwiczeniach, drillach językowych, transformacjach i Enclosure.',
    'business-speaking': 'Business & Role-Play: 5-6 slajdów z silnym naciskiem na konwersacje biznesowe, scenki sytuacyjne z celami ról i Enclosure.',
    'grammar-drills': 'Grammar in Action: 5 slajdów z objaśnieniem wzorca, analizą błędów, stopniowanymi ćwiczeniami Practice i Enclosure.'
  }[lessonStyle] || 'Standard CELTA 6-slajdowy';

  return `Zaprojektuj kompletną prezentację dydaktyczną z interaktywnymi ćwiczeniami dla modelu OpenAI 5.6 Luna.

PARAMETRY ZAJĘĆ:
- Temat: "${topic}"
- Poziom CEFR: ${level}
${studentName ? `- Kursant: ${studentName}` : ''}
- Główny cel / nacisk: ${focusArea}
- Szablon dydaktyczny: ${styleDescription}
${thingsToImprove ? `- Obszary do poprawy kursanta z poprzednich lekcji (zaadresuj je w ćwiczeniach!): "${thingsToImprove}"` : ''}
${customInstructions ? `- Specjalne wytyczne lektora: "${customInstructions}"` : ''}

WYMAGANA STRUKTURA JSON:
{
  "title": "Chwytliwy, profesjonalny tytuł prezentacji po angielsku",
  "topic": "${topic}",
  "targetLevel": "${level}",
  "aiModelUsed": "OpenAI 5.6 Luna",
  "slides": [
    {
      "id": "slide-1",
      "type": "title",
      "title": "Tytuł lekcji po angielsku",
      "subtitle": "Podtytuł / komunikat powitalny",
      "content": "Krótki, inspirujący zarys 3 głównych celów lekcji w punktach",
      "timerMinutes": 5,
      "speakerNotes": "Wskazówki dla lektora do sprawnego rozpoczęcia",
      "bgTheme": "emerald"
    },
    {
      "id": "slide-2",
      "type": "warmup",
      "title": "Warm-up & Discussion Triggers",
      "subtitle": "Pytania rozgrzewkowe na przełamanie barier",
      "items": [
        { "id": "w-1", "question": "Intrygujące pytanie rozgrzewkowe 1 po angielsku", "example": "Krótki zwrot pomocniczy" },
        { "id": "w-2", "question": "Pytanie rozgrzewkowe 2", "example": "Zwrot pomocniczy" },
        { "id": "w-3", "question": "Pytanie rozgrzewkowe 3 nawiązujące do doświadczeń", "example": "Zwrot pomocniczy" }
      ],
      "timerMinutes": 8,
      "speakerNotes": "Zachęć kursanta do pełnych wypowiedzi. Zwróć uwagę na płynność.",
      "bgTheme": "dark"
    },
    {
      "id": "slide-3",
      "type": "vocabulary",
      "title": "Target Vocabulary & Idiomatic Collocations",
      "subtitle": "Kluczowe zwroty z transkrypcją IPA i kontekstem",
      "items": [
        {
          "id": "v-1",
          "term": "Naturalna fraza/kolokacja po angielsku",
          "ipa": "/transkrypcja IPA/",
          "definition": "Polskie tłumaczenie i niuans znaczeniowy",
          "example": "Żywe, naturalne zdanie przykładowe po angielsku"
        },
        {
          "id": "v-2",
          "term": "Fraza 2",
          "ipa": "/transkrypcja IPA/",
          "definition": "Polskie tłumaczenie",
          "example": "Zdanie przykładowe"
        },
        {
          "id": "v-3",
          "term": "Fraza 3",
          "ipa": "/transkrypcja IPA/",
          "definition": "Polskie tłumaczenie",
          "example": "Zdanie przykładowe"
        },
        {
          "id": "v-4",
          "term": "Fraza 4",
          "ipa": "/transkrypcja IPA/",
          "definition": "Polskie tłumaczenie",
          "example": "Zdanie przykładowe"
        }
      ],
      "timerMinutes": 12,
      "speakerNotes": "Przećwicz wymowę trudniejszych dźwięków z IPA. Poproś o własne przykłady.",
      "bgTheme": "midnight"
    },
    {
      "id": "slide-4",
      "type": "grammar",
      "title": "Language Patterns & Common Pitfalls",
      "subtitle": "Wzorce językowe i eliminacja typowych błędów",
      "content": "Krótkie wyjaśnienie reguły / wzorca komunikacyjnego",
      "items": [
        {
          "id": "g-1",
          "errorText": "Typowy błąd kursantów (np. kalka z polskiego)",
          "correctionText": "Naturalny wariant angielski",
          "explanation": "Dlaczego forma poprawna brzmi naturalniej"
        },
        {
          "id": "g-2",
          "errorText": "Błąd 2",
          "correctionText": "Poprawna wersja",
          "explanation": "Wyjaśnienie zasady"
        }
      ],
      "timerMinutes": 10,
      "speakerNotes": "Upewnij się, że kursant rozumie różnicę między kalką a naturalnym zwrotem.",
      "bgTheme": "dark"
    },
    {
      "id": "slide-5",
      "type": "practice",
      "title": "Guided Practice & Real-time Drills",
      "subtitle": "Interaktywne zadania z odkrywanymi rozwiązaniami",
      "content": "Instrukcja: Przetłumacz lub uzupełnij poniższe sytuacje używając wprowadzonych fraz.",
      "items": [
        {
          "id": "p-1",
          "question": "Zadanie 1: Zdanie do przetłumaczenia lub sytuacja do reakcji",
          "hint": "Wskazówka (np. Użyj frazy poznanej na slajdzie ze słownictwem)",
          "answer": "Wzorcowa, płynna odpowiedź po angielsku",
          "revealed": false
        },
        {
          "id": "p-2",
          "question": "Zadanie 2: Trudniejsza sytuacja lub parafraza",
          "hint": "Wskazówka gramatyczno-leksykalna",
          "answer": "Wzorcowa odpowiedź po angielsku",
          "revealed": false
        },
        {
          "id": "p-3",
          "question": "Zadanie 3: Reakcja na wypowiedź rozmówcy",
          "hint": "Wskazówka",
          "answer": "Wzorcowa odpowiedź",
          "revealed": false
        }
      ],
      "timerMinutes": 15,
      "speakerNotes": "Pozwól kursantowi spróbować samodzielnie, przed odkryciem wzorca.",
      "bgTheme": "midnight"
    },
    {
      "id": "slide-6",
      "type": "enclosure",
      "title": "Enclosure & Quick Check",
      "subtitle": "Konsolidacja wiedzy, Exit Ticket i podsumowanie",
      "content": "Świetna robota! Sprawdźmy utrwalenie materiału w 3 szybkich pytaniach podsumowujących.",
      "quickCheck": [
        { "question": "Jak powiesz po angielsku: [Pojęcie 1 z lekcji]?", "answer": "[Prawidłowa fraza]", "hint": "Slajd ze słownictwem" },
        { "question": "Jak poprawisz zdanie: [Błędne zdanie z lekcji]?", "answer": "[Poprawne zdanie]", "hint": "Zwróć uwagę na przyimek" },
        { "question": "Kiedy używamy konstrukcji [Wzorzec z lekcji]?", "answer": "[Krótkie wyjaśnienie reguły]", "hint": "W kontekście..." }
      ],
      "exitTicketChallenge": "Ułóż 1 spontaniczne zdanie podsumowujące Twoje dzisiejsze plany/opinię używając przynajmniej 2 nowych wyrażeń!",
      "timerMinutes": 5,
      "speakerNotes": "Podsumuj postępy, pochwal za dobre reakcje i przekaż słówka do modułu Recall.",
      "bgTheme": "emerald"
    }
  ]
}`;
}

/**
 * Buduje prompt dla OpenAI 5.6 Luna do wygenerowania pojedynczego slajdu
 */
export function buildSingleSlidePrompt({
  topic,
  level = 'B2',
  slideType,
  customPrompt
}: {
  topic: string;
  level?: string;
  slideType: string;
  customPrompt?: string;
}): string {
  return `Jako OpenAI 5.6 Luna wygeneruj JEDEN konkretny slajd typu "${slideType}" do prezentacji lekcyjnej na temat "${topic}" (poziom ${level}).
${customPrompt ? `Wytyczne specjalne: "${customPrompt}"` : ''}

Zwróć WYŁĄCZNIE obiekt JSON reprezentujący ten jeden slajd:
{
  "id": "slide-${Date.now()}",
  "type": "${slideType}",
  "title": "Tytuł slajdu po angielsku",
  "subtitle": "Podtytuł",
  "content": "Treść opcjonalna lub instrukcja",
  "timerMinutes": 10,
  "speakerNotes": "Wskazówka dydaktyczna dla lektora",
  "bgTheme": "midnight",
  "items": [
    // Wypełnij elementami adekwatnymi do typu (np. vocabulary z term/ipa/definition/example, practice z question/hint/answer, itp.)
  ],
  "quickCheck": [
    // Tylko jeśli type == 'enclosure'
  ],
  "exitTicketChallenge": "Wyzwanie na koniec (jeśli enclosure)"
}`;
}

/**
 * Buduje prompt dla OpenAI 5.6 Luna do ulepszenia/przebudowania istniejącego slajdu
 */
export function buildEnhanceSlidePrompt({
  slide,
  instruction,
  level = 'B2'
}: {
  slide: any;
  instruction: string;
  level?: string;
}): string {
  return `Jako OpenAI 5.6 Luna ulepsz i zoptymalizuj poniższy slajd prezentacji lekcyjnej (poziom ${level}).

ORYGINALNY SLAJD:
${JSON.stringify(slide, null, 2)}

INSTRUKCJA ULEPSZENIA:
"${instruction}"

WYTYCZNE ULEPSZENIA:
- Podnieś naturalność języka angielskiego.
- Jeśli slajd ma słówka, dodaj transkrypcję IPA i żywe przykłady.
- Jeśli slajd to ćwiczenie (Practice/Enclosure), upewnij się, że ma pomocne wskazówki (hint) i wzorce odpowiedzi (answer).
- Usuń sztuczności i nadmiarowy tekst.

Zwróć WYŁĄCZNIE zaktualizowany obiekt JSON slajdu o zachowanym lub ulepszonym ID.`;
}
