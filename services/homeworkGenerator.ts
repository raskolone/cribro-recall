import {
  ErrorCorrectionExercise,
  HomeworkType,
  LessonRecord,
  MatchingExercise,
  MultipleChoiceExercise,
  TranslationExercise,
  WarmupExercise,
  WarmupDraftItem,
  WordOrderExercise,
} from '../types';
import {
  extractJSON,
  generateFillInTheBlankExercises,
  generateTextWithUnifiedFallback,
  generateTranslationExercises,
} from './geminiService';
import { getApprovedVocabularyText, splitVocabularyLines } from '../utils/vocabulary';
import { HOMEWORK_GENERATION_MODELS, PRIMARY_MODEL, assertHomeworkModelAllowed } from './aiModels';
import { WarmupVerdict, applyWarmupVerdicts, markAllUnverified, parseWarmupVerdicts } from '../utils/warmupJudge';
import { getStudentAiContext } from './learningProfile';
import { fetchLessonFlashcards } from './lessonRecord';
import {
  WarmupCardDraft,
  WarmupCardRejection,
  WARMUP_CARDS_MAX,
  collectLessonCards,
  parseGeneratedWarmupCards,
  planWarmupCardSource,
} from '../utils/warmupCards';
import { Type } from '@google/genai';
import {
  FIX_SENTENCE_ERROR_TYPES,
  buildUsedSentencesBlock,
  collectValidFixSentences,
  filterRepeatedSentences,
  checkWarmupExerciseItem,
  extractLessonTopics,
  WarmupFailureReason,
} from '../utils/exerciseSentenceChecks';
import { CRIBRO_SENTENCE_NATURALNESS, FIX_SENTENCE_RULES, buildFixSentenceRetryNote } from './cribroSentenceRules';
import {
  RegenerationTypeResult,
  buildRegenerationInstruction,
  collectItemSentences,
  groupSelectedByType,
  isRegeneratedItemValid,
} from '../utils/homeworkItems';

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
const MODELS_FOR_HOMEWORK: string[] = [...HOMEWORK_GENERATION_MODELS];
MODELS_FOR_HOMEWORK.forEach(assertHomeworkModelAllowed);

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
  /**
   * Zdania, które kursant już dostał w tej sesji (np. przed „Generuj kolejne
   * zdania"). Wchodzą do promptu jako zakaz i odsiewają wynik.
   */
  excludeSentences?: string[];
  /** Liczba par w jednym zestawie dopasowania; domyślnie wynika z `perType`. Używane przy regeneracji zestawu. */
  pairCount?: number;
}

export interface GeneratedSection {
  type: HomeworkType;
  items: any[];
  /** Wypełnione, gdy ten typ się nie wygenerował. */
  error?: string;
}

export interface HomeworkGenerationResult {
  sections: GeneratedSection[];
  warmup?: WarmupDraftItem[];
  /** Ile elementów rozgrzewki odrzucono i dlaczego (puste `warmup` + powód = rozgrzewka się nie wygenerowała). */
  warmupRejected?: number;
  warmupReasons?: WarmupFailureReason[];
  /** Fiszki rozgrzewki (osobno od `warmup`): z zestawu fiszek lekcji, z tekstu słownictwa albo z modelu. */
  warmupCards?: WarmupCardDraft[];
  warmupCardsRejected?: number;
  warmupCardsReasons?: WarmupCardRejection[];
  /** Zdania z pracy — wykluczenia dla ponownego generowania samej rozgrzewki. */
  usedSentences?: string[];
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
    pl: 'Uporządkuj',
    en: 'Unjumble',
    hint: {
      pl: 'Przeciągnij i upuść słowa, aby ułożyć poprawne zdanie.',
      en: 'Drag and drop the words to build the correct sentence.',
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
  matching: {
    pl: 'Dopasuj pary',
    en: 'Matching pairs',
    hint: {
      pl: 'Dopasuj słowo lub frazę do jej znaczenia.',
      en: 'Match a word or phrase to its meaning.',
    },
  },
};

/** Typy oferowane w kreatorze pracy domowej. */
export const OFFERED_HOMEWORK_TYPES: HomeworkType[] = [
  'translation',
  'find_errors',
  'multiple_choice',
  'fill_in_the_blank',
  'matching',
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
 * materiał, a nie znaczy nic sensownego. Zasady naturalności to wspólna
 * instrukcja Cribro Method (`services/cribroSentenceRules.ts`); poniżej tylko
 * to, czego ona nie obejmuje — żeby każdy typ zadania nie obrastał własną,
 * rozjeżdżającą się wersją.
 */
const QUALITY_RULES = `
${CRIBRO_SENTENCE_NATURALNESS}

ZASADY JAKOŚCI — OBOWIĄZUJĄ W KAŻDYM ZADANIU:
1. SENS PRZED SŁOWNICTWEM. Zdanie ma opisywać sytuację, która mogła się wydarzyć.
   Podmiot musi móc wykonać czynność, dopełnienie musi do niej pasować. Jeśli słowa
   z materiału nie dają się sensownie połączyć w jednym zdaniu — rozdziel je na dwa zdania.
2. JEDNO SŁOWO DOCELOWE NA ZDANIE. Upychanie kilku nowych słów naraz jest
   najczęstszą przyczyną zdań, które brzmią jak wyliczanka, a nie jak wypowiedź.
3. SPÓJNOŚĆ WEWNĘTRZNA. Czas gramatyczny, liczba i rodzajniki muszą zgadzać się
   w obrębie zdania, a określenia czasu nie mogą przeczyć użytemu czasowi
   („Yesterday I will call him" jest błędem).
4. KONTEKST Z LEKCJI. Sytuacje mają nawiązywać do tematu materiału — jeśli
   materiał dotyczy podróży, zdania dzieją się na lotnisku, w hotelu, w rozmowie
   o planach, a nie w przypadkowych, oderwanych scenkach.
5. BEZ ZDAŃ-WYDMUSZEK. Żadnych „This is a sentence with the word X" ani zdań,
   których jedyną treścią jest to, że zawierają słowo z listy.`;

import { formatOnlyFirstName, toPolishVocative } from '../utils/polishVocative';

export interface BuildStaticHomeworkNoteParams {
  studentName?: string;
  topicTitle?: string;
  lessonTopics?: string[];
  link?: string;
  language?: 'pl' | 'en';
}

/**
 * Zwraca temat lekcji bez prefiksów typu "Praca domowa:"/"Homework:" (dodawanych
 * przy tworzeniu zadania — patrz `HomeworkComposerV2.tsx`, `TeacherSpecialTaskModal.tsx`)
 * i bez wewnętrznych powtórzeń tego samego ciągu (np. gdy ten sam temat trafia
 * do notatki jednocześnie jako `topicTitle` z prefiksem i jako `lessonTopics` bez
 * niego — bez tego czyszczenia dają dwa różne stringi, więc zwykły `Set` ich nie scala).
 */
export function cleanTopic(rawTopic?: string): string {
  if (!rawTopic) return '';
  const withoutPrefix = rawTopic.trim().replace(/^(praca\s+domowa|homework)\s*[:\-–]\s*/i, '').trim();
  if (!withoutPrefix) return '';

  // Cały temat złożony z tego samego fragmentu sklejonego dwa razy (np. "X, X").
  const halfLength = withoutPrefix.length / 2;
  if (Number.isInteger(halfLength)) {
    const firstHalf = withoutPrefix.slice(0, halfLength).trim();
    const secondHalf = withoutPrefix.slice(halfLength).trim();
    if (firstHalf && firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      return firstHalf;
    }
  }

  // Temat złożony z kilku fragmentów oddzielonych przecinkiem/średnikiem, część powtórzona.
  const segments = withoutPrefix.split(/\s*[,;]\s*/).filter(Boolean);
  if (segments.length > 1) {
    const seen = new Set<string>();
    const unique = segments.filter((segment) => {
      const key = segment.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.join(', ');
  }

  return withoutPrefix;
}

/**
 * Statyczna, deterministyczna notatka do e-maila o nowej pracy domowej.
 *
 * Zastępuje dawne `generatePersonalizedHomeworkNote` (wołało model AI przy
 * KAŻDYM otwarciu `HomeworkEmailConfirmationModal.tsx`, zanim lektor
 * cokolwiek kliknął) — patrz AGENT_LOG.md, hotfix P0 (2026-09-20). Wołacz,
 * temat i link są już znane w momencie otwarcia modala, więc nie ma tu nic,
 * co wymagałoby swobodnej prozy LLM: zero wywołania modelu, zero ryzyka, że
 * wygenerowana treść będzie nie na temat.
 */
export function buildStaticHomeworkNote(params: BuildStaticHomeworkNoteParams): string {
  const { studentName, topicTitle, lessonTopics = [], link, language = 'pl' } = params;

  const seenTopics = new Set<string>();
  const uniqueTopics = [topicTitle, ...lessonTopics]
    .map(cleanTopic)
    .filter(Boolean)
    .filter((topic) => {
      const key = topic.toLowerCase();
      if (seenTopics.has(key)) return false;
      seenTopics.add(key);
      return true;
    });
  const topic = cleanTopic(uniqueTopics.join(', '));

  if (language === 'en') {
    const firstName = formatOnlyFirstName(studentName);
    const greeting = firstName ? `Hi ${firstName}!` : 'Hi!';
    const topicText = topic || 'a review set';
    return `${greeting} Following our last lesson, I've prepared a set of practice exercises for you: ${topicText}. Let me know how it goes!`;
  }

  const vocative = toPolishVocative(studentName);
  const greeting = vocative ? `Hej, ${vocative}!` : 'Cześć!';
  const topicText = topic || 'zestaw powtórkowy';
  return `${greeting} Po naszej ostatniej lekcji przygotowałem dla Ciebie zestaw ćwiczeń: ${topicText}. Daj znać, jak Ci poszło!`;
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
const askForJson = async (
  prompt: string,
  /** Schemat Gemini (`responseSchema`) — wymusza kształt odpowiedzi. */
  responseSchema?: object
): Promise<{ parsed: any; modelUsed: string }> => {
  console.log('[homeworkGenerator] Payload wysyłany do Gemini 2.5 Flash:', {
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
  });

  const { text, modelUsed } = await generateTextWithUnifiedFallback(
    prompt,
    SYSTEM_INSTRUCTION,
    MODELS_FOR_HOMEWORK,
    {
      responseMimeType: 'application/json',
      ...(responseSchema ? { responseSchema } : {}),
      thinkingConfig: { thinkingBudget: 0 },
    },
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
${buildUsedSentencesBlock(req.excludeSentences)}

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

  const freshItems = filterRepeatedSentences(items, req.excludeSentences || [], (item) => [
    item.correctSentence,
    item.polishHint,
  ]);

  return { items: freshItems, modelUsed };
};

export interface WarmupGenerationResult {
  items: WarmupDraftItem[];
  /** Liczba elementów odrzuconych przez walidację, filtr powtórek lub kontrolę jakości. */
  rejected: number;
  /** Powód każdego odrzucenia; przy błędzie całego wywołania — jeden wpis. */
  reasons: WarmupFailureReason[];
}

/**
 * Kontrola jakości: jedno wywołanie na cały zestaw. Zwraca wyroki w kolejności
 * wejścia; błąd wywołania leci do góry (wywołujący oznacza elementy `unverified`).
 */
export const judgeWarmupSentences = async (
  items: WarmupExercise[]
): Promise<Array<WarmupVerdict | null>> => {
  const list = items
    .map((item, index) => `${index}. EN: ${item.correctSentence}\n   PL: ${item.polishTranslation}`)
    .join('\n');
  const prompt = `${SYSTEM_INSTRUCTION}

ZADANIE: jesteś surowym recenzentem zdań do ćwiczeń. Oceń każdą parę zdań poniżej.
Dla każdej pary odpowiedz:
- ok = true tylko wtedy, gdy angielskie zdanie jest naturalne (native speaker mógłby je naprawdę powiedzieć),
  poprawne gramatycznie, logiczne znaczeniowo (podmiot może wykonać czynność; rzeczy nie "chcą", "lubią" ani "myślą")
  ORAZ polskie tłumaczenie brzmi po polsku (naturalnie, nie kalka słowo w słowo)
  ORAZ polskie zdanie znaczy TO SAMO co angielskie z tej samej pary (to samo zdarzenie, te same osoby i rzeczy) —
  polskie zdanie opisujące coś innego niż angielskie to błąd pary, nawet gdy oba brzmią dobrze;
- ok = false w każdym innym przypadku; w polu reason w kilku słowach po polsku napisz, co jest nie tak.

PARY:
${list}

Zwróć JSON z jednym wpisem na parę (index = numer pary):
{"verdicts":[{"index":0,"ok":true,"reason":""},{"index":1,"ok":false,"reason":"rzecz jako podmiot chcący coś robić"}]}`;
  const { parsed } = await askForJson(prompt);
  return parseWarmupVerdicts(parsed, items.length);
};

export const generateWarmupExercises = async (
  sourceText: string,
  accumulatedExcluded: string[]
): Promise<WarmupGenerationResult> => {
  const topics = extractLessonTopics(sourceText);
  const prompt = `${SYSTEM_INSTRUCTION}

[MATERIAŁ Z LEKCJI — TYLKO NA NIM PRACUJESZ]:
${sourceText}

ZADANIE:
Ułóż do 3 angielskich zdań opartych na podanym materiale (wykorzystaj te same kluczowe słowa i frazy co w materiale).
Każde zdanie musi przedstawiać NOWY kontekst i sytuację - zakaz powtórzenia i parafrazy zdań z listy wykluczeń.

TWARDE RAMY TREŚCI ZDANIA (ważniejsze niż użycie słownictwa):
- Podmiotem zdania jest OSOBA: I, we, you, he, she, they, imię albo rzeczownik określający osobę (np. my sister, our neighbour).
- Zdanie opisuje zwykłą, realną sytuację z życia — coś, co native speaker mógłby naprawdę powiedzieć.
- Fraza ze słownictwa jest użyta naturalnie, w dalszej części zdania — NIGDY jako podmiot.
- ZAKAZ używania tytułu tematu lekcji ani jego fragmentu jako podmiotu (np. temat "Describing your ideal home" nie daje zdania "My ideal home…").
- Unikaj zdań, w których rzecz lub miejsce czegoś chce, lubi, myśli albo robi coś, co potrafi tylko człowiek.
- Jeśli materiał to tylko temat lub krótki opis BEZ listy słów i fraz, najpierw wyprowadź z niego w głowie 4-6 typowych fraz tego tematu i na nich oprzyj zdania.
- DOBRY przykład: "My sister would like to have a big kitchen." (osoba jest podmiotem, fraza użyta naturalnie).
- ZŁY przykład: "My ideal home would like to have roomy spaces." (rzecz jako podmiot, nielogiczne).

Wymagania dla zdania:
1. Zdania po angielsku.
2. Długość zdania: 7-12 słów.
3. Każde zdanie podziel na 3-5 fragmentów po 2-4 słowa. Każdy fragment ma co najmniej 2 słowa.
4. Fragmenty w jednym zdaniu muszą być unikalne.
5. Końcowa kropka lub znak zapytania stoi w ostatnim fragmencie.
6. Fragmenty złożone ze spacjami muszą dać dokładnie correctSentence.
7. KOLEJNOŚĆ: najpierw ułóż poprawne angielskie zdanie (correctSentence), dopiero potem napisz polishTranslation.
8. polishTranslation to NATURALNA polszczyzna — oddaj sens zdania, nie tłumacz słowo w słowo. To ono będzie poleceniem dla kursanta, więc musi jednoznacznie wskazywać to zdanie. Element bez polishTranslation zostanie odrzucony.

${buildUsedSentencesBlock(accumulatedExcluded)}

Zwróć JSON w podanym formacie:
{"items":[{"correctSentence":"I have to meet the deadline by tomorrow morning.","chunks":["I have to","meet the deadline","by tomorrow morning."],"polishTranslation":"Muszę dotrzymać terminu jutro rano."}]}
`;

  try {
    const { parsed } = await askForJson(prompt);
    const raw = Array.isArray(parsed?.items) ? parsed.items : [];
    if (raw.length === 0) return { items: [], rejected: 0, reasons: ['no_items'] };

    const reasons: WarmupFailureReason[] = [];
    const items: WarmupExercise[] = [];
    for (const item of raw) {
      const check = checkWarmupExerciseItem(item, topics);
      if ('item' in check) {
        items.push(check.item);
      } else {
        reasons.push(check.reason);
        console.warn('[generateWarmupExercises] Odrzucono element rozgrzewki:', check.reason, item);
      }
    }

    const freshItems = filterRepeatedSentences(items, accumulatedExcluded, (item) => [
      item.correctSentence,
      item.polishTranslation,
    ]);
    for (let i = freshItems.length; i < items.length; i++) reasons.push('sentence_repeated');

    const candidates = freshItems.slice(0, 3);
    let finalItems: WarmupDraftItem[] = [];
    if (candidates.length > 0) {
      try {
        const verdicts = await judgeWarmupSentences(candidates);
        const judged = applyWarmupVerdicts(candidates, verdicts);
        finalItems = judged.items;
        reasons.push(...judged.reasons);
      } catch (judgeErr) {
        console.warn('[generateWarmupExercises] Kontrola jakości nie powiodła się — elementy oznaczone jako niezweryfikowane.', judgeErr);
        finalItems = markAllUnverified(candidates);
      }
    }

    return { items: finalItems, rejected: reasons.length, reasons };
  } catch (err) {
    console.error('[generateWarmupExercises] Błąd modelu lub brak wyników:', err);
    return { items: [], rejected: 0, reasons: ['model_error'] };
  }
};

export interface WarmupCardsGenerationResult {
  cards: WarmupCardDraft[];
  /** Liczba kart odrzuconych przez walidację. */
  rejected: number;
  /** Powód każdego odrzucenia; przy błędzie modelu lub braku kart — jeden wpis. */
  reasons: WarmupCardRejection[];
}

const WARMUP_CARDS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING, description: 'Angielska FRAZA lub słowo (1-5 słów), nie zdanie.' },
          definition: { type: Type.STRING, description: 'Krótkie polskie znaczenie, do 60 znaków.' },
          contextSentence: { type: Type.STRING, description: 'Opcjonalne krótkie angielskie zdanie z przykładem użycia frazy.' },
        },
        required: ['term', 'definition'],
        propertyOrdering: ['term', 'definition', 'contextSentence'],
      },
    },
  },
  required: ['cards'],
};

type JsonAsker = (prompt: string, responseSchema?: object) => Promise<{ parsed: any; modelUsed: string }>;

/**
 * Fiszki z samego tekstu / tematu: jedno wywołanie modelu (Gemini 2.5 Flash, bez sędziego).
 * Błąd modelu lub brak kart daje `cards: []` z powodem — nigdy wyjątek.
 */
export const generateWarmupCards = async (
  sourceText: string,
  taskSentences: string[] = [],
  ask: JsonAsker = askForJson
): Promise<WarmupCardsGenerationResult> => {
  const prompt = `${SYSTEM_INSTRUCTION}

[MATERIAŁ — TYLKO NA NIM PRACUJESZ]:
${sourceText}

ZADANIE:
Przygotuj 3-${WARMUP_CARDS_MAX} fiszek z najważniejszymi słowami i frazami z materiału.
Fiszka: strona 1 = angielska fraza (term), strona 2 = polskie znaczenie (definition).

ZASADY:
- KARTA TO FRAZA, NIE ZDANIE. term ma 1-5 słów (np. "arrive late", "have breakfast", "take off"). Pełne zdania jako term są zabronione.
- definition to krótkie, naturalne polskie znaczenie, najwyżej 60 znaków. Nie powtarzaj w nim angielskiej frazy.
- contextSentence (opcjonalnie) to jedno krótkie, naturalne angielskie zdanie pokazujące użycie frazy.
- Frazy się nie powtarzają. Używaj wyłącznie słownictwa z materiału; jeśli materiał to sam temat lub krótki opis bez listy słów, wyprowadź z niego typowe frazy tego tematu.

Zwróć JSON:
{"cards":[{"term":"arrive late","definition":"spóźnić się","contextSentence":"I arrived late to the meeting."}]}
`;

  try {
    const { parsed } = await ask(prompt, WARMUP_CARDS_SCHEMA);
    const result = parseGeneratedWarmupCards(parsed, taskSentences);
    for (const r of result.rejected) console.warn('[generateWarmupCards] Odrzucono kartę:', r.reason, r.raw);
    return {
      cards: result.cards.map((card) => ({ ...card, origin: 'ai' as const })),
      rejected: result.rejected.length,
      reasons: result.reasons,
    };
  } catch (err) {
    console.error('[generateWarmupCards] Błąd modelu:', err);
    return { cards: [], rejected: 0, reasons: ['model_error'] };
  }
};

/**
 * Fiszki dla wybranego materiału (tryb kreatora): lekcje → zestaw fiszek lekcji (zero AI),
 * zapasowo tekst słownictwa; wklejony tekst albo sam temat (lub lekcje bez żadnych kart) → model.
 * Nie rzuca.
 */
export const generateWarmupCardsForSource = async (
  source: HomeworkSource,
  sourceText: string,
  taskSentences: string[] = [],
  deps: { fetchFlashcards?: typeof fetchLessonFlashcards; ask?: JsonAsker } = {}
): Promise<WarmupCardsGenerationResult> => {
  const fetchFlashcards = deps.fetchFlashcards ?? fetchLessonFlashcards;
  const lessons = (source.lessons || []).map((l) => ({ id: l.id, topic: l.topic, vocabularyText: l.vocabularyText }));
  const plan = planWarmupCardSource(lessons.length > 0 ? 'lessons' : 'text', lessons, sourceText);

  if (plan.kind === 'ai') return generateWarmupCards(plan.sourceText, taskSentences, deps.ask);

  try {
    const perLesson = await Promise.all(
      plan.lessons.map(async (lesson) => ({
        flashcards: await fetchFlashcards(lesson.id).catch(() => []),
        vocabularyText: lesson.vocabularyText,
      }))
    );
    const fromLessons = collectLessonCards(perLesson, taskSentences);
    if (fromLessons.cards.length > 0) {
      return {
        cards: fromLessons.cards.map((card) => ({ ...card, origin: 'lesson' as const })),
        rejected: fromLessons.rejected.length,
        reasons: fromLessons.reasons,
      };
    }
    // Lekcje bez żadnych poprawnych kart (np. tylko temat) — model wyprowadza frazy z tematu.
    const generated = await generateWarmupCards(plan.aiFallbackText, taskSentences, deps.ask);
    return { ...generated, reasons: [...fromLessons.reasons, ...generated.reasons] };
  } catch (err) {
    console.error('[generateWarmupCardsForSource] Błąd:', err);
    return { cards: [], rejected: 0, reasons: ['model_error'] };
  }
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

/** Dopasuj pary: słowo/fraza po angielsku do znaczenia po polsku. */
const generateMatching = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): Promise<{ items: MatchingExercise[]; modelUsed: string }> => {
  const pairCount = req.pairCount ?? Math.max(4, Math.min(6, req.perType * 4));
  const prompt = `${baseContext(req, sourceText, briefing)}

ZADANIE:
Wybierz ${pairCount} słów lub krótkich fraz po angielsku z powyższego materiału i podaj ich
polskie znaczenie (proste, jednoznaczne tłumaczenie albo krótka definicja).

WYMAGANIA SZCZEGÓŁOWE DLA DOPASOWYWANIA PAR:
- Każde polskie znaczenie musi jednoznacznie wskazywać dokładnie jedno angielskie
  słowo/frazę z listy — bez dwuznaczności, które pasowałyby do kilku par naraz.
- Wybieraj słownictwo rzeczywiście obecne w materiale z lekcji, nie ogólne słówka.
- Bez powtórzeń — każde angielskie słowo/fraza występuje tylko raz.

Zwróć JSON:
{"pairs":[{"left":"deadline","right":"termin (ostateczny)"},{"left":"to catch up","right":"nadrobić zaległości"}]}`;

  const { parsed, modelUsed } = await askForJson(prompt);
  const rawPairs = Array.isArray(parsed?.pairs) ? parsed.pairs : [];

  const pairs = rawPairs
    .filter((p: any) => p?.left && p?.right)
    .map((p: any, i: number) => ({
      id: `pair-${i}`,
      left: String(p.left).trim(),
      right: String(p.right).trim(),
    }));

  const items: MatchingExercise[] = pairs.length >= 2 ? [{ pairs }] : [];

  return { items, modelUsed };
};

/**
 * Schemat odpowiedzi dla „Popraw zdanie".
 *
 * `propertyOrdering` jest częścią kontraktu, nie kosmetyką: model generuje
 * pola po kolei, więc najpierw pisze naturalne zdanie poprawne, potem
 * wybiera typ błędu, a dopiero na końcu psuje zdanie. Kolejność odwrotna
 * (błąd → zdanie) produkuje zdania budowane pod błąd.
 */
const FIX_SENTENCE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          correct_sentence: { type: Type.STRING, description: 'Naturalne, w pełni poprawne zdanie po angielsku — układane NAJPIERW.' },
          error_type: { type: Type.STRING, enum: [...FIX_SENTENCE_ERROR_TYPES], description: 'Jeden typ błędu pasujący do tego zdania.' },
          error_sentence: { type: Type.STRING, description: 'correct_sentence z DOKŁADNIE jednym błędem typu error_type. Musi różnić się od correct_sentence.' },
          explanation: { type: Type.STRING, description: 'Zwięzłe wyjaśnienie reguły po polsku.' },
          hint: { type: Type.STRING, description: 'Wskazówka po polsku kierująca uwagę na obszar błędu, bez podawania poprawki.' },
          polish_hint: { type: Type.STRING, description: 'Naturalne polskie znaczenie zdania.' },
        },
        required: ['correct_sentence', 'error_type', 'error_sentence', 'explanation', 'hint', 'polish_hint'],
        propertyOrdering: ['correct_sentence', 'error_type', 'error_sentence', 'explanation', 'hint', 'polish_hint'],
      },
    },
  },
  required: ['items'],
};

/**
 * „Popraw zdanie": zdania z jednym prawdziwym błędem do poprawy.
 *
 * Każde zadanie przechodzi `checkFixSentenceItem`. Zadanie bez błędu (zdanie
 * „z błędem" identyczne z poprawnym) dostaje jedną powtórkę z mocniejszą
 * instrukcją; jeśli nadal jest wadliwe — kursant go nie zobaczy.
 */
export const generateFindErrors = async (
  req: HomeworkGenerationRequest,
  sourceText: string,
  briefing?: string
): Promise<{ items: ErrorCorrectionExercise[]; modelUsed: string }> => {
  const buildPrompt = (count: number, retryNote: string) => `${baseContext(req, sourceText, briefing)}

ZADANIE:
Ułóż ${count} ${count === 1 ? 'zadanie' : 'zadań'} „Popraw zdanie" dla kursanta na poziomie ${req.level || 'B1'}.
Kursant dostaje zdanie z jednym błędem i przepisuje je poprawnie.
Oprzyj je na powyższym materiale z lekcji (słownictwo, temat oraz „Do poprawy u kursanta", jeśli są).

${FIX_SENTENCE_RULES}

POZOSTAŁE POLA:
- explanation: zwięzłe wyjaśnienie reguły po polsku (dlaczego forma jest błędna i jak brzmi zasada).
- hint: subtelna wskazówka po polsku, gdzie szukać błędu — bez podawania poprawki.
- polish_hint: naturalne polskie znaczenie zdania, żeby kursant znał intencję wypowiedzi.
${buildUsedSentencesBlock(req.excludeSentences)}
${retryNote}
Zwróć JSON:
{"items":[{"correct_sentence":"She doesn't eat meat, so let's book the Italian place.","error_type":"auxiliary_verb","error_sentence":"She don't eat meat, so let's book the Italian place.","explanation":"W 3. osobie liczby pojedynczej przeczenie w Present Simple tworzymy z 'doesn't', nie 'don't'.","hint":"Zwróć uwagę na czasownik posiłkowy w przeczeniu.","polish_hint":"Ona nie je mięsa, więc zarezerwujmy tę włoską knajpkę."}]}`;

  let modelUsed = HOMEWORK_MODEL;
  const batch = await collectValidFixSentences(async (retry) => {
    const prompt = retry
      ? buildPrompt(retry.missing, buildFixSentenceRetryNote(retry.missing, retry.rejectedErrorSentences))
      : buildPrompt(req.perType, '');
    const response = await askForJson(prompt, FIX_SENTENCE_SCHEMA);
    modelUsed = response.modelUsed;
    return Array.isArray(response.parsed?.items) ? response.parsed.items : [];
  });

  if (batch.dropped > 0) {
    console.warn(`[generateFindErrors] Odrzucono ${batch.dropped} zadań bez prawdziwego błędu (po powtórce).`);
  }

  const items: ErrorCorrectionExercise[] = batch.items.map((item) => ({
    type: 'find_errors',
    incorrectSentence: item.errorSentence,
    correctSentence: item.correctSentence,
    errorType: item.errorType,
    explanation: item.explanation,
    hint: item.hint,
    polishHint: item.polishHint,
  }));

  const freshItems = filterRepeatedSentences(items, req.excludeSentences || [], (item) => [
    item.correctSentence,
    item.incorrectSentence,
  ]);

  return { items: freshItems, modelUsed };
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
    MODELS_FOR_HOMEWORK,
    req.excludeSentences
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

/** Profil kursanta z krzywej uczenia (briefing + poziom) albo sam poziom od lektora, gdy kursanta brak. */
const resolveStudentContext = async (
  req: HomeworkGenerationRequest
): Promise<{ briefing?: string; level: string }> => {
  const context = req.studentId ? await getStudentAiContext(req.studentId, req.level) : null;
  return { briefing: context?.briefing, level: context?.level || req.level };
};

/**
 * Runnery typów — te same funkcje, te same prompty, reguły jakości i walidacja przy pierwszym
 * generowaniu i przy regeneracji. Dostają już policzony kontekst kursanta.
 */
const buildRunners = (
  sourceText: string,
  briefing: string | undefined,
  level: string
): Record<string, (subReq: HomeworkGenerationRequest) => Promise<{ items: any[]; modelUsed: string }>> => ({
  translation: (subReq) => generateTranslations(subReq, sourceText, briefing, level),
  find_errors: (subReq) => generateFindErrors(subReq, sourceText, briefing),
  multiple_choice: (subReq) => generateMultipleChoice(subReq, sourceText, briefing),
  fill_in_the_blank: (subReq) => generateGaps(subReq, sourceText, briefing, level),
  matching: (subReq) => generateMatching(subReq, sourceText, briefing),
});

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
  const { briefing, level } = await resolveStudentContext(req);

  const accumulatedExcluded = [...(req.excludeSentences || [])];
  let modelUsed: string | undefined;
  const sections: GeneratedSection[] = [];

  const runners = buildRunners(sourceText, briefing, level);

  const selected = req.types.filter((type) => runners[type]);

  for (const type of selected) {
    try {
      const subReq: HomeworkGenerationRequest = {
        ...req,
        excludeSentences: [...accumulatedExcluded],
      };
      const runnerResult = await runners[type](subReq);
      modelUsed = modelUsed || runnerResult.modelUsed;
      sections.push({ type, items: runnerResult.items });

      const newSentences = collectItemSentences(type, runnerResult.items);
      accumulatedExcluded.push(...newSentences);
    } catch (err: any) {
      console.error(`Nie udało się ułożyć zadań typu ${type}:`, err);
      sections.push({
        type,
        items: [],
        error: err?.message || 'Model nie zwrócił poprawnych zadań.',
      });
    }
  }

  // Rozsypka i fiszki są niezależne — lecą równolegle; żadna nie rzuca wyjątku.
  const [warmupResult, cardsResult] = await Promise.all([
    generateWarmupExercises(sourceText, accumulatedExcluded),
    generateWarmupCardsForSource(req.source, sourceText, accumulatedExcluded),
  ]);

  return {
    sections,
    warmup: warmupResult.items,
    warmupRejected: warmupResult.rejected,
    warmupReasons: warmupResult.reasons,
    warmupCards: cardsResult.cards,
    warmupCardsRejected: cardsResult.rejected,
    warmupCardsReasons: cardsResult.reasons,
    modelUsed,
    sourceText,
    usedSentences: accumulatedExcluded,
  };
};

export interface RegenerateItemsRequest {
  /** Ten sam materiał, na którym powstała praca (`HomeworkGenerationResult.sourceText`). */
  sourceText: string;
  sections: GeneratedSection[];
  /** `uid` zaznaczonych elementów. */
  selectedUids: string[];
  /** Sugestia lektora — dane do promptu, nie polecenie. Bez treści = zwykła regeneracja. */
  suggestion?: string;
  /** Zdania zakazane: pozostałe elementy + zaznaczone sprzed regeneracji (`buildRegenerationExclusions`). */
  excludeSentences: string[];
  level: string;
  studentId?: string;
  /** Wytyczne lektora z pierwszego generowania. */
  instruction?: string;
  /** „Ile zadań na typ" z pierwszego generowania — dla luk to liczba pustych miejsc w tekście. */
  perType: number;
}

/**
 * Regeneruje zaznaczone elementy: jedno wywołanie na typ, w prompcie tyle nowych elementów, ile
 * zaznaczono w typie (dopasowanie: jeden nowy zestaw par o tej samej liczbie par; luki: jeden nowy tekst).
 * Prompty, reguły jakości i walidacja są te same co przy pierwszym generowaniu (`buildRunners`).
 *
 * Błąd jednego typu nie psuje pozostałych: ten typ wraca z `error` i pustą listą podmian.
 * Wynik, który nie przeszedł walidacji albo powtarza zakazane zdanie, jest odrzucany.
 */
export const regenerateItems = async (req: RegenerateItemsRequest): Promise<RegenerationTypeResult[]> => {
  const groups = groupSelectedByType(req.sections, req.selectedUids);
  if (groups.length === 0) return [];

  const { briefing, level } = await resolveStudentContext({
    source: {},
    types: [],
    perType: req.perType,
    level: req.level,
    studentId: req.studentId,
  });
  const runners = buildRunners(req.sourceText, briefing, level);
  const excluded = [...req.excludeSentences];
  const results: RegenerationTypeResult[] = [];

  for (const group of groups) {
    const run = runners[group.type];
    if (!run) {
      results.push({ type: group.type, replacements: [], error: 'Ten typ zadań nie obsługuje ponownego generowania.' });
      continue;
    }

    try {
      const isSetType = group.type === 'matching' || group.type === 'fill_in_the_blank';
      // Zestaw par i tekst z lukami to jeden element; liczność liczą pary / luki.
      const wanted = isSetType ? 1 : group.items.length;
      const subReq: HomeworkGenerationRequest = {
        source: {},
        types: [group.type],
        perType: group.type === 'fill_in_the_blank' ? req.perType : wanted,
        pairCount: group.type === 'matching' ? group.items[0]?.pairs?.length || undefined : undefined,
        level: req.level,
        studentId: req.studentId,
        instruction:
          buildRegenerationInstruction({
            baseInstruction: req.instruction,
            suggestion: req.suggestion,
            type: group.type,
            replacedItems: group.items,
          }) || undefined,
        excludeSentences: [...excluded],
      };

      const { items } = await run(subReq);
      const fresh = filterRepeatedSentences(
        items.filter((item) => isRegeneratedItemValid(group.type, item)),
        excluded,
        (item) => collectItemSentences(group.type, [item])
      ).slice(0, wanted);

      if (fresh.length === 0) {
        results.push({
          type: group.type,
          replacements: [],
          error: 'Model nie zwrócił poprawnych zadań tego typu.',
        });
        continue;
      }

      results.push({
        type: group.type,
        replacements: fresh.map((item, i) => ({ uid: group.uids[i], item })),
        ...(fresh.length < wanted ? { partial: { got: fresh.length, wanted } } : {}),
      });
      excluded.push(...collectItemSentences(group.type, fresh));
    } catch (err: any) {
      console.error(`Nie udało się ponownie ułożyć zadań typu ${group.type}:`, err);
      results.push({
        type: group.type,
        replacements: [],
        error: err?.message || 'Model nie zwrócił poprawnych zadań.',
      });
    }
  }

  return results;
};
