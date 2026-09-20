import {
  ErrorCorrectionExercise,
  HomeworkType,
  LessonRecord,
  MultipleChoiceExercise,
  TranslationExercise,
  WordOrderExercise,
} from '../types';
import {
  extractJSON,
  generateFillInTheBlankExercises,
  generateTextWithUnifiedFallback,
  generateTranslationExercises,
} from './geminiService';
import { getApprovedVocabularyText, splitVocabularyLines } from '../utils/vocabulary';
import { HOMEWORK_GENERATION_MODELS, PRIMARY_MODEL } from './aiModels';
import { getStudentAiContext } from './learningProfile';

/**
 * Układanie pracy domowej z materiału lektora.
 *
 * Wejściem jest zawsze tekst: albo złożony z wybranych lekcji kursanta, albo
 * wklejony ręcznie. Model dostaje ten sam materiał niezależnie od typu zadania,
 * więc jedno zadanie domowe trzyma się jednego słownictwa, nawet gdy składa się
 * z kilku rodzajów ćwiczeń.
 *
 * Każdy typ leci osobnym zapytaniem. Jedno zapytanie o wszystko byłoby tańsze,
 * ale wtedy błąd parsowania jednego rodzaju kasuje całą pracę domową — tak
 * odpada tylko ta jedna sekcja, a lektor widzi, czego zabrakło.
 */

/**
 * Model, który układa zadania — pierwszy z ogólnej kaskady aplikacji.
 *
 * Praca domowa nie ma powodu chodzić po innych modelach niż reszta aplikacji:
 * kolejność i schodzenie niżej definiuje `services/aiModels.ts`.
 */
export const HOMEWORK_MODEL = PRIMARY_MODEL;

/**
 * Praca domowa NIE schodzi na inne modele niż Gemini 2.5 Flash — patrz
 * uzasadnienie przy `HOMEWORK_GENERATION_MODELS` w `services/aiModels.ts`.
 */
const MODELS_FOR_HOMEWORK = HOMEWORK_GENERATION_MODELS;

export interface HomeworkSource {
  /** Lekcje wybrane przez lektora. */
  lessons?: LessonRecord[];
  /** Materiał wklejony ręcznie. */
  pastedText?: string;
}

export interface HomeworkGenerationRequest {
  source: HomeworkSource;
  types: HomeworkType[];
  /** Ile zadań na każdy wybrany typ. */
  perType: number;
  level: string;
  /** Wskazówka lektora, np. „skup się na czasach przeszłych". */
  instruction?: string;
  /**
   * Kursant, dla którego układamy zadania. Podany — model dostaje jego profil
   * z krzywej uczenia (poziom wyliczony z wyników, ostatnie błędy) zamiast
   * samego poziomu z pola `level`.
   */
  studentId?: string;
}

export interface GeneratedSection {
  type: HomeworkType;
  items: any[];
  /** Wypełnione, gdy ten typ się nie wygenerował. */
  error?: string;
}

export interface HomeworkGenerationResult {
  sections: GeneratedSection[];
  modelUsed?: string;
  /** Materiał, na którym pracował model — do pokazania lektorowi. */
  sourceText: string;
}

/** Etykiety typów — jedno miejsce dla obu paneli. */
export const HOMEWORK_TYPE_LABELS: Record<
  HomeworkType,
  { pl: string; en: string; hint: { pl: string; en: string } }
> = {
  translation: {
    pl: 'Tłumaczenie zdań',
    en: 'Sentence translation',
    hint: { pl: 'Kursant tłumaczy z polskiego na angielski.', en: 'Student translates PL to EN.' },
  },
  word_order: {
    pl: 'Ułóż zdanie',
    en: 'Word order',
    hint: {
      pl: 'Rozsypane fragmenty do ułożenia. Bez klawiatury, samym dotykiem.',
      en: 'Scrambled chunks to arrange. Tap only, no keyboard.',
    },
  },
  multiple_choice: {
    pl: 'Wybierz formę',
    en: 'Multiple choice',
    hint: {
      pl: 'Jedna poprawna odpowiedź z kilku. Sprawdza się od razu.',
      en: 'One correct answer out of several. Checked instantly.',
    },
  },
  fill_in_the_blank: {
    pl: 'Uzupełnij luki',
    en: 'Fill in the blanks',
    hint: { pl: 'Spójny tekst z lukami do uzupełnienia.', en: 'A short text with gaps to fill.' },
  },
  find_errors: {
    pl: 'Znajdź błędy',
    en: 'Spot the mistakes',
    hint: { pl: 'Zdania z błędami do poprawienia.', en: 'Sentences with mistakes to correct.' },
  },
};

/** Typy oferowane w kreatorze pracy domowej. */
export const OFFERED_HOMEWORK_TYPES: HomeworkType[] = [
  'translation',
  'find_errors',
  'word_order',
  'multiple_choice',
  'fill_in_the_blank',
];

/**
 * Składa materiał źródłowy w jeden tekst.
 *
 * Z lekcji bierzemy zatwierdzone słownictwo, a nie cały wklej — to ten sam
 * materiał, który kursant widzi w panelu i który wchodzi do powtórek. Temat
 * i streszczenie idą jako kontekst, żeby zdania nie były oderwane od zajęć.
 */
export const buildSourceText = (source: HomeworkSource): string => {
  const parts: string[] = [];

  (source.lessons || []).forEach((lesson) => {
    const vocabulary = getApprovedVocabularyText({
      vocabularyText: lesson.vocabularyText,
      approvedItems: (lesson as any).approvedItems,
    });
    const lines = splitVocabularyLines(vocabulary);
    parts.push(
      [
        `LEKCJA (${lesson.date}): ${lesson.topic || ''}`.trim(),
        lesson.lessonSummary ? `Przerabialiśmy: ${lesson.lessonSummary}` : '',
        lesson.thingsToImprove ? `Do poprawy u kursanta: ${lesson.thingsToImprove}` : '',
        lines.length > 0 ? `Słownictwo:\n${lines.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  });

  if (source.pastedText && source.pastedText.trim()) {
    parts.push(`MATERIAŁ OD LEKTORA:\n${source.pastedText.trim()}`);
  }

  return parts.join('\n\n---\n\n').slice(0, 8000);
};

const SYSTEM_INSTRUCTION =
  'Jesteś doświadczonym lektorem języka angielskiego układającym pracę domową dla konkretnego kursanta. ' +
  'Pracujesz WYŁĄCZNIE na materiale podanym przez lektora — nie wprowadzasz słownictwa spoza niego. ' +
  'ZASADA NADRZĘDNA: każde zdanie musi być prawdziwym zdaniem, jakie ktoś mógłby wypowiedzieć w realnej ' +
  'sytuacji — sensownym znaczeniowo, spójnym wewnętrznie i osadzonym w czytelnym kontekście. Zdanie ' +
  'poprawne gramatycznie, ale bezsensowne znaczeniowo („The invoice drinks the deadline"), jest błędem ' +
  'równie ciężkim jak błąd gramatyczny i nie wolno go zwrócić. Użycie słowa z materiału nigdy nie ' +
  'usprawiedliwia zdania, które nie ma sensu. ' +
  'Odpowiadasz zawsze poprawnym JSON-em, bez komentarzy i bez bloków markdown.';

/**
 * Kanon jakości dołączany do każdego typu zadania.
 *
 * Model dostaje słownictwo i temat, więc łatwo mu ułożyć zdanie, które zalicza
 * materiał, a nie znaczy nic sensownego. Te zasady są w jednym miejscu, bo
 * inaczej każdy typ zadania obrastałby własną, rozjeżdżającą się wersją.
 */
const QUALITY_RULES = `
ZASADY JAKOŚCI — OBOWIĄZUJĄ W KAŻDYM ZADANIU:
1. SENS PRZED SŁOWNICTWEM. Zdanie ma opisywać sytuację, która mogła się wydarzyć.
   Podmiot musi móc wykonać czynność, dopełnienie musi do niej pasować, a całość
   ma się bronić bez dopowiadania kontekstu. Jeśli słowa z materiału nie dają się
   sensownie połączyć w jednym zdaniu — rozdziel je na dwa zdania.
2. JEDNO SŁOWO DOCELOWE NA ZDANIE. Upychanie kilku nowych słów naraz jest
   najczęstszą przyczyną zdań, które brzmią jak wyliczanka, a nie jak wypowiedź.
3. SPÓJNOŚĆ WEWNĘTRZNA. Czas gramatyczny, liczba i rodzajniki muszą zgadzać się
   w obrębie zdania, a określenia czasu nie mogą przeczyć użytemu czasowi
   („Yesterday I will call him" jest błędem).
4. NATURALNA POLSZCZYZNA. Polskie zdania i podpowiedzi mają brzmieć jak zdania
   Polaka, nie jak tłumaczenie słowo w słowo z angielskiego.
5. KONTEKST Z LEKCJI. Sytuacje mają nawiązywać do tematu materiału — jeśli
   materiał dotyczy podróży, zdania dzieją się na lotnisku, w hotelu, w rozmowie
   o planach, a nie w przypadkowych, oderwanych scenkach.
6. BEZ ZDAŃ-WYDMUSZEK. Żadnych „This is a sentence with the word X" ani zdań,
   których jedyną treścią jest to, że zawierają słowo z listy.`;

import { formatPolishGreeting } from '../utils/polishVocative';

export interface GeneratePersonalizedNoteParams {
  studentName?: string;
  topicTitle?: string;
  lessonTopics?: string[];
  vocabularySample?: string[];
  exerciseCount?: number;
  exerciseTypes?: HomeworkType[];
}

/**
 * Inteligentny prompt tworzący spersonalizowaną notatkę od lektora (Macieja)
 * do kursanta na temat przypisanej pracy domowej, nawiązując do konkretnych
 * tematów i słownictwa z lekcji, zwracając się po imieniu w wołaczu.
 */
export async function generatePersonalizedHomeworkNote(params: GeneratePersonalizedNoteParams): Promise<string> {
  const {
    studentName,
    topicTitle,
    lessonTopics = [],
    vocabularySample = [],
    exerciseCount = 6,
  } = params;

  const vocativeGreeting = formatPolishGreeting(studentName);
  const topicsSummary = Array.from(new Set([topicTitle, ...lessonTopics].filter(Boolean))).join(', ');
  const vocabSummary = vocabularySample.slice(0, 8).join(', ');

  const systemInstruction = `Jesteś Maciejem Wyrozumskim — doświadczonym lektorem i metodykiem języka angielskiego (CRIBRO ENGLISH, www.maciej.pro).
Twój styl komunikacji: naturalny, ciepły, profesjonalny, konkretny i motywujący.
Zwracasz się bezpośrednio do kursanta po imieniu w polskim wołaczu (np. Cześć, Bartłomieju!).
Pisz w 1. osobie („Przygotowałem dla Ciebie...", „Skupiłem się w nich na...").`;

  const prompt = `Napisz krótką, naturalną i spersonalizowaną wiadomość ode mnie (Macieja) dla kursanta o nowej pracy domowej.
DANE WEJŚCIOWE:
- Imię i powitanie kursanta: ${vocativeGreeting}
- Temat ostatniej lekcji / lekcji powiązanych: ${topicsSummary || 'nasze ostatnie zajęcia'}
- Zakres ćwiczonych zwrotów / słownictwa: ${vocabSummary || 'praktyczne zwroty z lekcji'}
- Przybliżona liczba zadań: ${exerciseCount}

WYMAGANIA:
1. Rozpocznij od powitania w wołaczu: "${vocativeGreeting}".
2. Napisz w 1. osobie, że ułożyłeś kilka zadań w oparciu o naszą ostatnią lekcję.
3. Krótko i zwięźle (w 1-2 zdaniach) opisz, do czego odwołują się te zadania i co kursant w nich przećwiczy (nawiąż do tematu "${topicsSummary || 'omawianego materiału'}").
4. Wspomnij przyjaźnie, że zrobienie ich zajmie tylko 5–10 minut i warto je przejrzeć przed naszym kolejnym spotkaniem.
5. Całość to maksymalnie 2–3 zwięzłe zdania. Zwróć wyłącznie samą treść wiadomości, bez cudzysłowów i bez podpisu.`;

  try {
    const { text } = await generateTextWithUnifiedFallback(
      prompt,
      systemInstruction,
      MODELS_FOR_HOMEWORK,
      undefined,
      undefined,
      { taskName: 'Generowanie personalizacji notatki HW', category: 'homework', timeoutMs: 6000, maxRetries: 1 }
    );
    const cleaned = text.trim().replace(/^["']|["']$/g, '');
    if (cleaned && cleaned.length > 20) {
      return cleaned;
    }
  } catch (err) {
    console.warn('[homeworkGenerator] Błąd szybkiej personalizacji AI, używam szablonu regułowego:', err);
  }

  // Fallback regułowy o wysokiej jakości
  const topicFragment = topicsSummary ? ` dotyczącą „${topicsSummary}”` : '';
  const vocabFragment = vocabSummary
    ? ` W zadaniach skupiłem się na utrwaleniu kluczowego słownictwa (${vocabSummary}) oraz praktycznych struktur z zajęć.`
    : ' W zadaniach skupiłem się na utrwaleniu kluczowych struktur i zwrotów z naszych zajęć.';
  return `${vocativeGreeting} Przygotowałem dla Ciebie kilka zadań w oparciu o naszą ostatnią lekcję${topicFragment}.${vocabFragment} Ich wykonanie zajmie Ci około 5–10 minut — zachęcam do zrobienia ich przed naszym kolejnym spotkaniem!`;
}

/**
 * Jedyne dopuszczalne wywołanie modelu dla pracy domowej: Gemini 2.5 Flash,
 * bez cichego zejścia na OpenAI. `thinkingBudget: 0`, bo to zadanie
 * generatywne, nie rozumowanie — dodatkowe "myślenie" tylko wydłuża czas
 * odpowiedzi bez poprawy jakości.
 *
 * Błąd (w tym pusta odpowiedź / niepoprawny JSON) leci wprost do wywołującego
 * z oryginalnym komunikatem od Google — żadnego maskowania przejściem na
 * inny model, żeby lektor widział prawdziwą przyczynę awarii.
 */
const askForJson = async (prompt: string): Promise<{ parsed: any; modelUsed: string }> => {
  console.log('[homeworkGenerator] Payload wysyłany do Gemini 2.5 Flash:', {
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
  });

  const { text, modelUsed } = await generateTextWithUnifiedFallback(
    prompt,
    SYSTEM_INSTRUCTION,
    MODELS_FOR_HOMEWORK,
    { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    undefined,
    // Maksymalnie 1 ponowienie przy błędzie sieciowym (maxRetries: 2 = próba + 1 retry).
    { taskName: 'Układanie pracy domowej (Gemini 2.5 Flash)', category: 'homework', timeoutMs: 15000, maxRetries: 2 }
  );

  if (!text || !text.trim()) {
    throw new Error('Gemini 2.5 Flash zwrócił pustą odpowiedź.');
  }

  try {
    return { parsed: JSON.parse(extractJSON(text)), modelUsed };
  } catch (parseErr: any) {
    throw new Error(
      `Gemini 2.5 Flash zwrócił odpowiedź, której nie da się odczytać jako JSON: ${parseErr?.message || parseErr}`
    );
  }
};

/**
 * Kontekst wspólny dla każdego typu zadania.
 *
 * Briefing z krzywej uczenia idzie przed materiałem, bo rozstrzyga o trudności
 * każdego układanego zdania — a materiał mówi tylko, z czego je zbudować.
 */
const baseContext = (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): string => `
${briefing || `[POZIOM KURSANTA]: ${req.level || 'B1'}`}
${req.instruction ? `[WYTYCZNE LEKTORA]: ${req.instruction}` : ''}

[MATERIAŁ Z LEKCJI — TYLKO NA NIM PRACUJESZ]:
${sourceText}
${QUALITY_RULES}
`;

/** Ułóż zdanie: fragmenty tasujemy u nas, żeby model nie „pomagał" kolejnością. */
const generateWordOrder = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): Promise<{ items: WordOrderExercise[]; modelUsed: string }> => {
  const prompt = `${baseContext(req, sourceText, briefing)}

ZADANIE:
Ułóż ${req.perType} angielskich zdań opartych na powyższym materiale. Każde zdanie
podziel na 4–8 sensownych fragmentów (pojedyncze słowa albo krótkie frazy, np. "have to",
"in the morning"). Fragmenty podaj W POPRAWNEJ KOLEJNOŚCI — przetasujemy je sami.
Do każdego zdania dołącz jego polskie znaczenie.

WYMAGANIA SZCZEGÓŁOWE DLA UKŁADANIA ZDANIA:
- Zdanie musi mieć DOKŁADNIE JEDNĄ poprawną kolejność. Jeśli fragmenty da się
  ułożyć na dwa sposoby i oba są poprawne (np. okolicznik czasu pasuje na
  początku i na końcu), przebuduj zdanie — inaczej kursant dostanie błąd za
  odpowiedź, która jest dobra.
- Fragmenty tnij po granicach naturalnych całości: "have to", "in the morning",
  "my younger sister". Nie rozrywaj kolokacji ani czasownika złożonego.
- Polska podpowiedź (pole polishHint) to znaczenie całego zdania, a nie lista słów.
  Ma jednoznacznie wskazywać, o które zdanie chodzi.
- Unikaj zdań, które po przetasowaniu składają się z samych krótkich, podobnych
  fragmentów — takie zadanie sprawdza cierpliwość, nie język.

Zwróć JSON:
{"items":[{"chunks":["I","have to","meet the deadline"],"correctSentence":"I have to meet the deadline.","polishHint":"Muszę dotrzymać terminu."}]}`;

  const { parsed, modelUsed } = await askForJson(prompt);
  const raw = Array.isArray(parsed?.items) ? parsed.items : [];

  const items: WordOrderExercise[] = raw
    .filter((item: any) => Array.isArray(item?.chunks) && item.chunks.length >= 2)
    .map((item: any) => {
      const chunks: string[] = item.chunks.map((c: any) => String(c).trim()).filter(Boolean);
      const correct =
        String(item.correctSentence || chunks.join(' ')).trim() || chunks.join(' ');
      // Tasowanie po naszej stronie: model potrafi zwrócić „przetasowaną"
      // kolejność, która wciąż czyta się poprawnie, i zadanie robi się puste.
      const shuffled = [...chunks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return {
        chunks: shuffled,
        correctSentence: correct,
        polishHint: item.polishHint ? String(item.polishHint) : undefined,
      };
    });

  return { items, modelUsed };
};

/** Wybór formy: pilnujemy, żeby poprawna odpowiedź naprawdę była wśród opcji. */
const generateMultipleChoice = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): Promise<{ items: MultipleChoiceExercise[]; modelUsed: string }> => {
  const prompt = `${baseContext(req, sourceText, briefing)}

ZADANIE:
Ułóż ${req.perType} pytań wielokrotnego wyboru sprawdzających słownictwo i gramatykę
z powyższego materiału. Każde pytanie to zdanie z luką oznaczoną "___".
Podaj 4 opcje: jedną poprawną i trzy błędne, ale prawdopodobne (typowe błędy Polaka).
Dodaj krótkie wyjaśnienie po polsku, dlaczego poprawna jest właśnie ta forma.

WYMAGANIA SZCZEGÓŁOWE DLA WYBORU FORMY:
- Zdanie z luką musi mieć sens PO WSTAWIENIU poprawnej opcji i musi dawać dość
  kontekstu, żeby dało się ją wybrać. Jeśli zdanie działa z dwiema opcjami
  naraz, dopisz kontekst („... because the flight leaves at 6 a.m.") albo
  zmień pytanie.
- DOKŁADNIE JEDNA opcja może być poprawna. Warianty równoważne znaczeniowo
  („I must" i „I have to" w tym samym zdaniu) to błąd konstrukcyjny.
- Błędne opcje mają być wiarygodne: kalka z polskiego, mylony czas, zły przyimek,
  częsty błąd ortograficzny. Nie wstawiaj opcji absurdalnych ani zbudowanych
  z przypadkowych słów — one niczego nie sprawdzają.
- Wszystkie cztery opcje muszą pasować do luki gramatycznie na tyle, żeby wybór
  wymagał zrozumienia zdania, a nie odsiania jedynej opcji, która „wygląda jak
  zdanie".
- Wyjaśnienie po polsku ma mówić, DLACZEGO ta forma, a nie powtarzać treści
  zdania.

Zwróć JSON:
{"items":[{"question":"I ___ for the sales team.","options":["am responsible","responsible","am responsable","responsible for"],"correctIndex":0,"explanation":"..."}]}`;

  const { parsed, modelUsed } = await askForJson(prompt);
  const raw = Array.isArray(parsed?.items) ? parsed.items : [];

  const items: MultipleChoiceExercise[] = raw
    .filter(
      (item: any) =>
        item?.question &&
        Array.isArray(item.options) &&
        item.options.length >= 2 &&
        Number.isInteger(item.correctIndex) &&
        item.correctIndex >= 0 &&
        item.correctIndex < item.options.length
    )
    .map((item: any) => ({
      question: String(item.question).trim(),
      options: item.options.map((o: any) => String(o).trim()),
      correctIndex: item.correctIndex,
      explanation: item.explanation ? String(item.explanation) : undefined,
    }));

  return { items, modelUsed };
};

/** Znajdź błąd w zdaniu: generujemy zdania z jednym konkretnym, wiarygodnym błędem do poprawy. */
export const generateFindErrors = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): Promise<{ items: ErrorCorrectionExercise[]; modelUsed: string }> => {
  const prompt = `${baseContext(req, sourceText, briefing)}

ZADANIE:
Ułóż ${req.perType} zdań w języku angielskim zawierających DOKŁADNIE JEDEN, jednoznaczny błąd gramatyczny,
leksykalny, przyimkowy, szyku wyrazów lub formy czasownika (ang. Spot the mistake / Find the error).
Zadaniem kursanta jest zidentyfikowanie tego błędu i podanie w pełni poprawionego zdania.
Materiały oprzyj na powyższym materiale z lekcji (wykorzystaj słownictwo, tematy oraz sekcje "Do poprawy u kursanta", jeśli są obecne).

WYMAGANIA SZCZEGÓŁOWE DLA ZADAŃ TYPU ZNAJDŹ BŁĄD (find_errors):
- Zdanie musi zawierać DOKŁADNIE JEDEN błąd, typowy dla polskiego ucznia na poziomie ${req.level || 'B1'}
  (np. zły przyimek np. "interested for" zamiast "in", zły czasownik posiłkowy np. "She don't" zamiast "doesn't",
  brak końcówki -s w 3. os., kalka z polskiego, pomylony czas gramatyczny, fałszywy przyjaciel, zły szyk).
- Zdanie musi brzmieć naturalnie w kontekście i mieć sens — nie twórz zdań absurdalnych.
- Do każdego zadania dołącz:
  1. incorrectSentence: zdanie po angielsku zawierające ten jeden błąd.
  2. correctSentence: w pełni poprawne zdanie po angielsku (bez błędu).
  3. explanation: jasne, zwięzłe wyjaśnienie reguły po polsku (dlaczego forma była błędna i jak brzmi zasada).
  4. hint: subtelna wskazówka po polsku kierująca uwagę na obszar błędu (np. "Zwróć uwagę na czasownik posiłkowy w przeczeniu.").
  5. polishHint: naturalne polskie znaczenie zdania (żeby uczeń znał intencję wypowiedzi).

Zwróć JSON:
{"items":[{"incorrectSentence":"She don't like working overtime on Fridays.","correctSentence":"She doesn't like working overtime on Fridays.","explanation":"W 3. osobie liczby pojedynczej czasu Present Simple przeczenie tworzymy za pomocą 'doesn't', a nie 'don't'.","hint":"Zwróć uwagę na czasownik posiłkowy w przeczeniu.","polishHint":"Ona nie lubi pracować po godzinach w piątki."}]}`;

  const { parsed, modelUsed } = await askForJson(prompt);
  const raw = Array.isArray(parsed?.items) ? parsed.items : [];

  const items: ErrorCorrectionExercise[] = raw
    .filter((item: any) => item?.incorrectSentence && item?.correctSentence)
    .map((item: any) => ({
      type: 'find_errors',
      incorrectSentence: String(item.incorrectSentence).trim(),
      correctSentence: String(item.correctSentence).trim(),
      explanation: item.explanation ? String(item.explanation).trim() : undefined,
      hint: item.hint ? String(item.hint).trim() : undefined,
      polishHint: item.polishHint ? String(item.polishHint).trim() : undefined,
    }));

  return { items, modelUsed };
};

/** Tłumaczenia — istniejący generator, tylko z materiałem z tego kreatora. */
const generateTranslations = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string,
  level?: string
): Promise<{ items: TranslationExercise[]; modelUsed: string }> => {
  const words = splitVocabularyLines(sourceText).slice(0, 40);
  const result = await generateTranslationExercises(
    level || req.level || 'B1',
    words,
    req.instruction,
    sourceText,
    // Slot na profil kursanta istniał tu od początku i szedł pusty — teraz
    // wchodzi w niego briefing z krzywej uczenia.
    briefing,
    req.perType,
    undefined,
    undefined,
    undefined,
    undefined,
    MODELS_FOR_HOMEWORK
  );
  const items = Array.isArray(result) ? result : [];
  return { items, modelUsed: items[0]?.modelUsed || HOMEWORK_MODEL };
};

/** Tekst z lukami — istniejący generator. */
const generateGaps = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string,
  level?: string
): Promise<{ items: any[]; modelUsed: string }> => {
  const result = await generateFillInTheBlankExercises(
    level || req.level || 'B1',
    sourceText.slice(0, 2000),
    req.perType,
    [req.instruction, briefing].filter(Boolean).join('\n\n'),
    MODELS_FOR_HOMEWORK
  );
  return { items: result ? [result] : [], modelUsed: HOMEWORK_MODEL };
};

/**
 * Generuje wszystkie wybrane typy równolegle.
 *
 * `allSettled`, bo odrzucenie jednego typu nie może zabrać lektorowi reszty —
 * dostaje to, co się udało, i informację o tym, co nie.
 */
export const generateHomeworkSet = async (
  req: HomeworkGenerationRequest
): Promise<HomeworkGenerationResult> => {
  const sourceText = buildSourceText(req.source);
  if (!sourceText.trim()) {
    throw new Error('Brak materiału: wybierz lekcje albo wklej własny tekst.');
  }

  // Profil kursanta rozstrzyga o trudności. Bez `studentId` (np. przy pracy na
  // wklejonym tekście bez wybranego kursanta) zostaje sam poziom od lektora.
  const context = req.studentId
    ? await getStudentAiContext(req.studentId, req.level)
    : null;
  const briefing = context?.briefing;
  const level = context?.level || req.level;

  const runners: Record<string, () => Promise<{ items: any[]; modelUsed: string }>> = {
    translation: () => generateTranslations(req, sourceText, briefing, level),
    find_errors: () => generateFindErrors(req, sourceText, briefing),
    word_order: () => generateWordOrder(req, sourceText, briefing),
    multiple_choice: () => generateMultipleChoice(req, sourceText, briefing),
    fill_in_the_blank: () => generateGaps(req, sourceText, briefing, level),
  };

  const selected = req.types.filter((type) => runners[type]);
  const settled = await Promise.allSettled(selected.map((type) => runners[type]()));

  let modelUsed: string | undefined;
  const sections: GeneratedSection[] = selected.map((type, index) => {
    const outcome = settled[index];
    if (outcome.status === 'fulfilled') {
      modelUsed = modelUsed || outcome.value.modelUsed;
      return { type, items: outcome.value.items };
    }
    console.error(`Nie udało się ułożyć zadań typu ${type}:`, outcome.reason);
    return {
      type,
      items: [],
      error: outcome.reason?.message || 'Model nie zwrócił poprawnych zadań.',
    };
  });

  return { sections, modelUsed, sourceText };
};
