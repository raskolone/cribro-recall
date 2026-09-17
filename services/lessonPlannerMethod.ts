/**
 * METODA CRIBRO — WYTYCZNE PLANERA LEKCJI JAKO PROMPT.
 *
 * ══ SKĄD TO POCHODZI ══
 *
 * Odwzorowanie skilla „🎯 Skill - Lesson Planner" z Notion (Prompts &
 * Instructions) wraz z obowiązującymi go nadpisaniami z „🎯 Lesson Planner —
 * Master Prompt & System". Źródłem prawdy pozostaje Notion: jeżeli Maciej
 * zmieni tam zasady, TEN plik trzeba zaktualizować — aplikacja nie czyta
 * skilla na żywo, bo scenariusz musi dać się wygenerować także wtedy, gdy
 * Notion jest niedostępny albo integracja wygasła.
 *
 * ══ CO JEST TU ŚWIADOMIE POMINIĘTE ══
 *
 * Krok 3 skilla („zapisz kartę w bazie Historia Lekcji") NIE jest częścią
 * tego promptu. W Recall scenariusz zapisuje `scenarioService`, a do Notion
 * trafia osobną drogą — model ma UŁOŻYĆ lekcję, a nie decydować o zapisie.
 *
 * Pętla uczenia się na bazie „Pytania wykorzystane na lekcjach" też tu nie
 * wchodzi: to zapytanie do Notion, którego aplikacja jeszcze nie robi.
 * Zamiast udawać, że model ma te dane, mówimy mu wprost, że ich nie ma —
 * inaczej zaczyna wymyślać „sprawdzone wzorce", których nikt nie sprawdził.
 */

export interface LessonBrief {
  /** Tryb zajęć — decyduje o kształcie Warm-upu i Practice Enclosure. */
  mode: '1:1' | 'grupa';
  /** Imię kursanta albo nazwa grupy. Bez tego planer nie rusza. */
  audience: string;
  /** Data zajęć (YYYY-MM-DD). */
  date: string;
  /** Poziom CEFR. */
  level: string;
  /** Temat gramatyczny — pusty znaczy „bez sekcji Grammar Review". */
  grammarTopic?: string;
  /** Materiał źródłowy opisany słowami albo wklejony przez lektora. */
  sourceMaterial?: string;
  /** Streszczenie ostatnich lekcji — podstawa Revision Translation. */
  history?: string;
  /** Dodatkowe uwagi lektora. */
  notes?: string;
}

/** Czy brief wystarcza, żeby w ogóle zacząć (Krok 0 skilla). */
export const briefGate = (brief: Partial<LessonBrief>): string[] => {
  const missing: string[] = [];
  if (!brief.mode) missing.push('tryb zajęć (1:1 czy grupa)');
  if (!brief.audience?.trim()) missing.push('kursant albo nazwa grupy');
  if (!brief.date?.trim()) missing.push('data lekcji');
  return missing;
};

const briefBlock = (brief: LessonBrief): string => `
DANE LEKCJI (potwierdzone przez lektora — nie podważaj ich i nie pytaj o nie ponownie):
- Tryb: ${brief.mode === 'grupa' ? 'grupa 2–4 osoby' : 'lekcja 1:1'}
- ${brief.mode === 'grupa' ? 'Grupa' : 'Kursant'}: ${brief.audience}
- Data lekcji: ${brief.date}
- Poziom CEFR: ${brief.level}
- Gramatyka: ${
  brief.grammarTopic?.trim()
    ? `TAK — temat: ${brief.grammarTopic.trim()}. Wstaw sekcję Grammar Review.`
    : 'NIE — pomiń sekcję Grammar Review całkowicie, bez pustego placeholdera.'
}
${brief.sourceMaterial?.trim() ? `\nMATERIAŁ ŹRÓDŁOWY OD LEKTORA:\n${brief.sourceMaterial.trim()}` : ''}
${brief.history?.trim() ? `\nHISTORIA OSTATNICH LEKCJI (podstawa Revision Translation — bierz WYŁĄCZNIE z ostatniej lekcji):\n${brief.history.trim()}` : '\nBRAK HISTORII — to pierwsza lekcja. Zbuduj plan bez odniesień do przeszłości i bez Revision Translation z poprzedniej lekcji.'}
${brief.notes?.trim() ? `\nUWAGI LEKTORA: ${brief.notes.trim()}` : ''}
`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   TEST NATURALNOŚCI — powtarzany przy KAŻDYM zadaniu, nie tylko przy
   generowaniu całości. To jedyna reguła skilla, którą model łamie
   najczęściej, a łamie ją po cichu: pytanie brzmi mądrze i przechodzi.
   ═══════════════════════════════════════════════════════════════════════ */
const NATURALNESS_TEST = `
TEST NATURALNOŚCI PYTAŃ (obowiązkowy, dotyczy WSZYSTKICH pytań w Warm-up i Main Topic):
1. Test dwóch sekund — pytanie musi dać się zrozumieć i zacząć na nie odpowiadać w mniej niż 2 sekundy, bez czytania dwa razy.
2. Jedno pytanie = jedna myśl. Nigdy nie sklejaj dwóch pytań przez „and" albo „or".
3. Język mówiony, nie eseistyczny. Żadnych konstrukcji z pracy zaliczeniowej („What is your opinion regarding the impact of...").
4. Konkret, nie abstrakcja — pytanie zaczepia się o osobiste doświadczenie, konkretną sytuację albo realny wybór.
5. Kontekst samowystarczalny — pytanie nie zakłada wiedzy, której nie ma w Topic and Material / Lead-in.

ZAKAZ SZTUCZNEGO SŁOWNICTWA W WARM-UP: nie używaj słów w rodzaju „headspace", „bandwidth", „leverage", „facilitate", „optimise", jeśli wystarczy prostsze słowo. Nie zadawaj pytań-ankiet typu „How has your week been so far?" ani „Has anything gone surprisingly well this week?" — brzmią jak formularz, nie jak rozmowa. Kursant ma odpowiedzieć HISTORIĄ, nie raportem stanu.

Przed zapisaniem każdego pytania zadaj sobie pytanie: „Czy powiedziałbym to normalnemu człowiekowi na początku lekcji?". Jeśli nie — przepisz albo wyrzuć.

❌ „What is your opinion regarding the impact of remote work on interpersonal relationships?"
✅ „Has working from home made it harder to actually feel close to people you work with?"
❌ „What did you do last weekend and do you think weekends are important?"
✅ „What's one thing you try to do every weekend, no matter how busy you are?"
`.trim();

/** Prompt systemowy wspólny dla wszystkich wywołań planera. */
export const CRIBRO_METHOD_SYSTEM = `
Jesteś asystentem metodycznym pracującym wyłącznie według THE CRIBRO METHOD. Układasz scenariusze 60-minutowych lekcji konwersacyjnych General English — 1:1 albo dla małej grupy (2–4 osoby).

FILOZOFIA SZKIELETU 15-MINUTOWEGO: jeden szkielet, zero decyzji. Temat i słownictwo się zmieniają, struktura zostaje. Jeśli materiał nie mieści się w szkielecie — PRZYTNIJ MATERIAŁ, nigdy nie rozciągaj szkieletu.

JĘZYK: komentarze metodyczne po polsku, cała treść kierowana do kursanta (pytania, słownictwo, zadania, przykłady) po angielsku.

${NATURALNESS_TEST}

CZEGO NIE MASZ: nie masz dostępu do bazy „Pytania wykorzystane na lekcjach" ani do żadnych danych o tym, które pytania sprawdziły się na prawdziwych zajęciach. NIE WOLNO ci twierdzić, że wzorzec „zadziałał wcześniej", ani powoływać się na nieistniejące dane. Opierasz się na profilu kursanta, materiale źródłowym i Teście naturalności.

FILTR SZUMU — przy każdej pokusie dodania czegoś poza szablonem zadaj sobie pytanie: „Mniej znaczy więcej. Z czego rezygnujemy?".
`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   KROK 1 — PROPOZYCJE TEMATU

   Skill mówi: gdy lektor nie podał materiału, zaproponuj 2–3 opcje z baz
   i POCZEKAJ NA WYBÓR. W Recall to jest osobny krok z własnym ekranem,
   bo bez niego planer od razu wypluwał gotową lekcję na temat, którego
   nikt nie wybierał.
   ═══════════════════════════════════════════════════════════════════════ */

export const buildTopicProposalPrompt = (
  brief: LessonBrief,
  variantCount: number,
  teacherSuggestion?: string
): string => `
${briefBlock(brief)}

${teacherSuggestion?.trim() ? `SUGESTIA LEKTORA CO DO TEMATU:\n${teacherSuggestion.trim()}\nPotraktuj ją jako kierunek obowiązujący — warianty mają być różnymi UJĘCIAMI tej sugestii, a nie tematami obok niej.` : 'Lektor nie podał sugestii tematu. Zaproponuj warianty dopasowane do poziomu, historii i tego, co wiadomo o kursancie.'}

ZADANIE: przygotuj DOKŁADNIE ${variantCount} ${variantCount === 1 ? 'wariant' : variantCount < 5 ? 'warianty' : 'wariantów'} tematu tej lekcji. Nic więcej — nie układaj jeszcze scenariusza.

Każdy wariant ma być WYRAŹNIE INNYM kątem, a nie przeformułowaniem tego samego. Jeżeli lektor nie podał materiału źródłowego, opieraj warianty na typach materiałów z zatwierdzonych baz (ESL Brains, Breaking News English, iSLCollective, iteslj.org) — ale NIE zmyślaj konkretnych tytułów artykułów ani linków, których nie znasz. Opisz materiał rodzajowo („krótki artykuł prasowy o…", „nagranie wideo, w którym…").

Zwróć WYŁĄCZNIE poprawny JSON:
{
  "variants": [
    {
      "title": "Temat lekcji — zwięźle, bez daty, maksymalnie 60 znaków",
      "angle": "Jednym zdaniem po polsku: na czym polega ten kąt i czym różni się od pozostałych",
      "material": "Jakiego materiału źródłowego użyjemy — rodzajowo, po polsku",
      "why": "Dlaczego akurat ten temat pasuje do tego kursanta: poziom, historia, zainteresowania. Po polsku, 1–2 zdania",
      "sampleQuestion": "Jedno przykładowe pytanie dyskusyjne PO ANGIELSKU, przechodzące Test naturalności — próbka tonu całej lekcji"
    }
  ]
}
`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   KROK 2 — PEŁNY SCENARIUSZ

   Scenariusz wraca jako JSON z sekcjami, a nie jako jeden blok markdown.
   Powód jest praktyczny: lektor ma móc ZAZNACZYĆ pojedynczy element
   i kazać go przerobić. Jeden wielki tekst nie da się zaznaczyć po
   kawałku — element musi mieć własny identyfikator już w chwili powstania.
   ═══════════════════════════════════════════════════════════════════════ */

export interface InteractiveExercise {
  id: string;
  title?: string;
  type: 'quiz' | 'sentence_scramble' | 'error_hunt' | 'vocab_match' | 'interactive_quiz';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
  scrambledWords?: string[];
}

export type PlanItemKind =
  | 'question'
  | 'text'
  | 'vocab'
  | 'correction'
  | 'task'
  | 'answerKey'
  | 'note'
  | 'topic_material'
  | 'lead_in'
  | 'thought_provoking_questions'
  | 'interactive';

export interface PlanItemTeacherNotes {
  goal?: string;
  scaffolding?: string;
  followUp?: string;
}

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  text: string;
  notes?: string;
  checked?: boolean;
  checkable?: boolean;
  safetyBankNote?: string;
  methodologyNote?: string;
  teacherNotes?: PlanItemTeacherNotes;
  exercise?: InteractiveExercise;
}

export interface PlanSection {
  id: string;
  title: string;
  minutes?: string;
  duration?: string;
  items: PlanItem[];
  topicMaterialDescription?: string;
  thoughtProvokingDescription?: string;
  methodologicalTip?: string;
  interactiveExercises?: InteractiveExercise[];
}

export interface LessonPlan {
  title: string;
  summary: string;
  format?: string;
  goal?: string;
  sourceMaterialDescription?: string;
  sections: PlanSection[];
  interactiveExercises?: InteractiveExercise[];
}

export const buildScenarioPrompt = (
  brief: LessonBrief,
  chosenTopic: { title: string; angle?: string; material?: string }
): string => `
${briefBlock(brief)}

WYBRANY TEMAT (zatwierdzony przez lektora — trzymaj się go):
- Tytuł: ${chosenTopic.title}
${chosenTopic.angle ? `- Kąt: ${chosenTopic.angle}` : ''}
${chosenTopic.material ? `- Materiał: ${chosenTopic.material}` : ''}

ZADANIE: ułóż pełny scenariusz 60-minutowej lekcji według struktury i metody Cribro, kropka w kropkę w formacie wymaganym przez system.

METADANE LEKCJI (wypełnij precyzyjnie w JSON na samej górze):
- "format": np. "indywidualna lekcja General English, 60 minut, poziom ${brief.level}"
- "goal": konkretny cel komunikacyjny i gramatyczny (np. "praktyczne mówienie o pracy, osobach i sprzęcie z użyciem ${brief.grammarTopic || 'docelowych struktur'}")
- "sourceMaterialDescription": dokładny opis adaptacji banku materiałów (np. "I-TESL-J — ESL Conversation Questions... adaptacja zawęża materiał do kontekstu ${brief.audience} i poziomu ${brief.level}.")

STRUKTURA SEKCJI I TWARDE LICZBY:
1. Revision and Warm Up (10 min)
   - DOKŁADNIE 5 pytań check-in (kind: "question"). ${brief.mode === 'grupa' ? 'Wspólne pytania z icebreakerem.' : `Spersonalizowane pod ${brief.audience} na podstawie historii.`}
   - Revision Translation: 3–5 zdań PL→EN z poprzedniej lekcji wraz z kluczem odpowiedzi.
   - Older Lesson Refresh: 1 pytanie lub słówko z wcześniejszych zajęć.

${brief.grammarTopic?.trim() ? `2. Grammar Review — ${brief.grammarTopic.trim()} (10 min)
   - Krótkie wyjaśnienie (3–4 zdania po polsku), 3–4 zdania przykładowe z angielskim, szybka praktyka ustna.` : ''}

${brief.grammarTopic?.trim() ? '3' : '2'}. Main Topic — ${chosenTopic.title} (${brief.grammarTopic?.trim() ? '28 min' : '30 min'})
   - Sekcja ma zawierać dedykowane opisy:
     * topicMaterialDescription: zwięzły opis adaptacji źródła do środowiska kursanta.
     * thoughtProvokingDescription: "Pytania są bankiem bezpieczeństwa. Nie musisz wykorzystać wszystkich; wybierz te, które naturalnie pasują do kierunku rozmowy."
     * methodologicalTip: konkretna wskazówka metodyczna dla lektora (np. "${brief.audience} potrzebuje krótkich pytań i czasu na znalezienie słów. Najpierw zaakceptuj prostą odpowiedź, potem dodaj jeden follow-up.")
   - W sekcji umieść następujące pozycje ("items"):
     * 2–3 punkty z celami do przeczytania kursantowi na głos (kind: "topic_material", np. "Today we will talk about your job.")
     * 1 punkt zadania wprowadzającego (kind: "lead_in", np. "Tell me three simple facts about...")
     * DOKŁADNIE 10 pytań dyskusyjnych (kind: "question").
     * Przy KAŻDYM z 10 pytań pole "notes" MUSI zawierać zwięzłą Budkę Suflera w 3 stałych punktach:
       • Cel: [cel dydaktyczny pytania po polsku]
       • Scaffolding: [początki zdań i zwroty pomocnicze po angielsku w kursywie, np. I work as a... / I am responsible for...]
       • Follow-up: [jedno naturalne pytanie pogłębiające po angielsku, np. What is one important task in your job?]

${brief.grammarTopic?.trim() ? '4' : '3'}. Language Focus (12 min)
   - Delayed Correction: 3–5 typowych błędów powiązanych z tematem (kind: "correction", błędna wersja → poprawna).
   - Key Vocabulary: DOKŁADNIE 5 pozycji kluczowych (kind: "vocab", format: "english phrase - polskie tłumaczenie").

${brief.grammarTopic?.trim() ? '6' : '5'}. Practice Enclosure (10 min) — ĆWICZENIA INTERAKTYWNE LIVE (Kahoot-style do wyświetlenia kursantowi):
   - Przygotuj DOKŁADNIE 3–4 interaktywne zadania (kind: "interactive").
   - Każde zadanie wyposaż w obiekt "exercise" z polami:
     * "id": unikalny id (np. "quiz-1")
     * "type": "quiz" (wybór 1 z 4 opcji), "sentence_scramble" (układanie klocków), lub "error_hunt" (znajdź błąd)
     * "question": treść zadania dla kursanta po angielsku
     * "options": 4 opcje do wyboru (dla quizu) lub lista klocków słownych (dla scramble)
     * "correctAnswer": poprawna odpowiedź (indeks opcji 0..3 lub poprawne zdanie)
     * "explanation": zwięzłe wyjaśnienie po polsku dlaczego ta odpowiedź jest poprawna

${brief.grammarTopic?.trim() ? '7' : '6'}. Wrap-up & Homework (5 min) — Podsumowanie i Sugerowana Praca Domowa:
   - 1 punkt podsumowujący główne wnioski z lekcji (kind: "text").
   - DOKŁADNIE 1 konkretny obszar do przećwiczenia jako praca domowa (kind: "task", np. "Zadanie pisemne / ułożenie 5 zdań: Argumentacja i negocjowanie z użyciem nowych zwrotów i konstrukcji gramatycznych z lekcji.") wraz z zwięzłą wskazówką metodyczną w polu "notes".

Zwróć WYŁĄCZNIE poprawny JSON o strukturze:
{
  "title": "${chosenTopic.title}",
  "summary": "2–3 zdania po polsku dla lektora: o czym jest ta lekcja",
  "format": "indywidualna lekcja General English, 60 minut, poziom ${brief.level}",
  "goal": "Praktyczne mówienie o...",
  "sourceMaterialDescription": "I-TESL-J — ESL Conversation Questions...",
  "sections": [
    {
      "id": "warmup",
      "title": "1. Revision and Warm Up (10 min)",
      "minutes": "10 min",
      "items": [
        {
          "id": "warmup-q1",
          "kind": "question",
          "text": "What did you usually check first at work today?",
          "notes": "• Cel: wejście w temat dnia.\\n• Scaffolding: First I checked... / Usually I start with...\\n• Follow-up: Did anything surprise you today?"
        }
      ]
    },
    {
      "id": "maintopic",
      "title": "3. Main Topic — ${chosenTopic.title} (28 min)",
      "minutes": "28 min",
      "topicMaterialDescription": "Materiał źródłowy: bank pytań adaptowany pod kontekst kursanta.",
      "thoughtProvokingDescription": "Pytania są bankiem bezpieczeństwa. Nie musisz wykorzystać wszystkich; wybierz te, które naturalnie pasują do kierunku rozmowy.",
      "methodologicalTip": "Kursant potrzebuje krótkich pytań i czasu na znalezienie słów. Najpierw zaakceptuj prostą odpowiedź, potem dodaj follow-up.",
      "items": [
        { "id": "main-tm-1", "kind": "topic_material", "text": "Today we will talk about your job." },
        { "id": "main-lead-1", "kind": "lead_in", "text": "Tell me three simple facts about your work." },
        {
          "id": "main-q1",
          "kind": "question",
          "text": "What do you do at work?",
          "notes": "• Cel: wejście w temat przez znaną informację o stanowisku.\\n• Scaffolding: I work as a... / I am responsible for...\\n• Follow-up: What is one important task in your job?"
        }
      ]
    },
    {
      "id": "homework",
      "title": "6. Wrap-up & Homework (5 min)",
      "minutes": "5 min",
      "items": [
        {
          "id": "hw-summary",
          "kind": "text",
          "text": "Podsumowanie kluczowych wniosków i zastosowania zwrotów w praktyce."
        },
        {
          "id": "hw-task",
          "kind": "task",
          "text": "Sugerowana praca domowa: Ułożenie 5 zdań z nowo poznanym słownictwem w kontekście realnych sytuacji z pracy.",
          "notes": "Obszar do przećwiczenia: Utrwalenie struktur gramatycznych oraz słownictwa z sekcji Language Focus."
        }
      ]
    }
  ]
}
`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   KROK 3 — POPRAWKA ZAZNACZONYCH ELEMENTÓW

   Model dostaje CAŁY scenariusz jako kontekst, ale wolno mu zmienić
   WYŁĄCZNIE zaznaczone elementy. Bez tego ograniczenia każda prośba
   o poprawienie jednego pytania wracała jako przepisana cała lekcja —
   i lektor tracił wszystko, co wcześniej zaakceptował.
   ═══════════════════════════════════════════════════════════════════════ */

export const buildRevisionPrompt = (
  brief: LessonBrief,
  scenarioJson: string,
  selectedIds: string[],
  instruction: string
): string => `
${briefBlock(brief)}

AKTUALNY SCENARIUSZ (pełny kontekst JSON):
${scenarioJson}

${
  selectedIds.length > 0
    ? `ELEMENTY ZAZNACZONE PRZEZ LEKTORA DO ZMIANY (identyfikatory):\n${selectedIds.map(id => `- ${id}`).join('\n')}\n\nTWARDE OGRANICZENIE: Lektor wskazał konkretne elementy. Zmień przede wszystkim te elementy, zachowując spójność reszty scenariusza.`
    : 'Lektor prosi o modyfikację / uzupełnienie w czacie bez wskazywania konkretnych identyfikatorów.'
}

POLECENIE LEKTORA:
${instruction.trim()}

ZASADY:
- Każdy zmieniony lub dodany element musi przejść Test naturalności pytań i być dopasowany do poziomu ${brief.level}.
- Zachowaj format Teacher's Notes w 3 punktach: Cel, Scaffolding, Follow-up.
- Jeśli polecenie dotyczy ćwiczenia interaktywnego, wygeneruj obiekt "exercise" (quiz z options, correctAnswer, explanation).

Zwróć WYŁĄCZNIE poprawny JSON zawierający zmodyfikowane elementy lub dodane elementy:
{
  "updates": [
    {
      "id": "istniejący-id",
      "text": "zaktualizowana treść",
      "notes": "zaktualizowane Teacher's Notes albo pusty string",
      "exercise": {
        "id": "quiz-id",
        "type": "quiz",
        "question": "pytanie",
        "options": ["A", "B", "C", "D"],
        "correctAnswer": 0,
        "explanation": "wyjaśnienie"
      }
    }
  ],
  "addedItems": [
    {
      "sectionId": "maintopic",
      "item": {
        "id": "new-item-1",
        "kind": "question",
        "text": "Nowe pytanie",
        "notes": "• Cel: ...\n• Scaffolding: ...\n• Follow-up: ..."
      }
    }
  ],
  "deletedIds": [],
  "comment": "Jedno–dwa zdania po polsku: co zmieniłeś i dlaczego"
}
`.trim();

/**
 * Wyciąga sugerowaną pracę domową z planu lekcji.
 */
export const extractHomeworkTask = (
  plan: LessonPlan
): { taskText: string; taskNotes?: string } | null => {
  for (const section of plan.sections) {
    const isHwSec = section.id.toLowerCase().includes('homework') ||
      section.id.toLowerCase().includes('wrap') ||
      section.title.toLowerCase().includes('homework') ||
      section.title.toLowerCase().includes('praca domowa');
    
    for (const item of section.items) {
      if (item.kind === 'task' || (isHwSec && (item.text.toLowerCase().includes('praca domowa') || item.text.toLowerCase().includes('homework')))) {
        return {
          taskText: item.text,
          taskNotes: item.notes || section.methodologicalTip,
        };
      }
    }
  }
  return null;
};

/**
 * Wyciąga listę słówek z sekcji Language Focus / słownictwa.
 */
export const extractVocabularyList = (plan: LessonPlan): string[] => {
  const result: string[] = [];
  for (const section of plan.sections) {
    for (const item of section.items) {
      if (item.kind === 'vocab' && item.text.trim()) {
        result.push(item.text.trim());
      }
    }
  }
  return result;
};

