/**
 * ExerciseGenerator — zadania jako ustrukturyzowane dane.
 *
 * Generator NIE ocenia własnej pracy. Kontrola jakości to osobne wywołanie
 * w `qualityValidator.ts` (§10) — model pytany w tym samym przebiegu „czy to
 * dobre zadanie?" odpowiada „tak" niezależnie od tego, co napisał.
 *
 * Generator też nie zapisuje niczego do bazy. Zwraca dane, a decyzję
 * o przypisaniu podejmuje lektor na ekranie podglądu.
 */

import { randomUUID } from 'crypto';

import { AssembledContext, renderContextForPrompt } from './contextAssembler';
import {
  ENGINE_VERSION,
  ExerciseContractV2,
  ExerciseTypeV2,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from './contracts';
import { EXERCISE_TYPE_BRIEFS, buildCoreSystemPrompt } from './coreKnowledge';
import { PlannedSlot } from './exercisePlanner';
import { ModelCall } from './openai';

/** Surowe zadanie prosto od modelu — przed walidacją i przed nadaniem tożsamości. */
export interface DraftExercise {
  exerciseType: ExerciseTypeV2;
  learningObjective: string;
  content: string;
  instruction: string;
  modelAnswer: string;
  acceptedVariants: string[];
  requiredMaterial: string[];
  commonMistakes: string[];
  hintSmall: string;
  hintLarge: string;
  /** Indeks lekcji (1-based), z której wzięty jest materiał. */
  sourceLessonIndex: number;
  /**
   * Tylko `fix_sentence`: typ wprowadzonego błędu. Nie trafia do kontraktu
   * (schemat v2 jest zamrożony) — służy walidacji i regeneracji.
   */
  errorType?: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];

/**
 * Odsiewa to, co nie jest zadaniem.
 *
 * Model potrafi zwrócić poprawny JSON o niepoprawnej treści — brakujący
 * wzorzec, pusty cel, `requiredMaterial` jako string zamiast tablicy.
 * Lepiej stracić jedno zadanie tutaj niż zapisać kalekie do bazy.
 */
export const parseDraft = (raw: unknown, fallbackType: ExerciseTypeV2): DraftExercise | null => {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;

  if (!isNonEmptyString(d.content)) return null;
  if (!isNonEmptyString(d.modelAnswer)) return null;
  if (!isNonEmptyString(d.learningObjective)) return null;

  const requiredMaterial = asStringArray(d.requiredMaterial);
  if (requiredMaterial.length === 0) return null;

  return {
    exerciseType: (isNonEmptyString(d.exerciseType) ? d.exerciseType : fallbackType) as ExerciseTypeV2,
    learningObjective: String(d.learningObjective).trim(),
    content: String(d.content).trim(),
    instruction: isNonEmptyString(d.instruction) ? String(d.instruction).trim() : '',
    modelAnswer: String(d.modelAnswer).trim(),
    acceptedVariants: asStringArray(d.acceptedVariants),
    requiredMaterial,
    commonMistakes: asStringArray(d.commonMistakes),
    hintSmall: isNonEmptyString(d.hintSmall) ? String(d.hintSmall).trim() : '',
    hintLarge: isNonEmptyString(d.hintLarge) ? String(d.hintLarge).trim() : '',
    sourceLessonIndex: typeof d.sourceLessonIndex === 'number' ? d.sourceLessonIndex : 1,
    ...(isNonEmptyString(d.errorType) ? { errorType: String(d.errorType).trim() } : {}),
  };
};

const buildGeneratorPrompt = (context: AssembledContext, slots: PlannedSlot[]): string => {
  const typeBriefs = Array.from(new Set(slots.map((s) => s.exerciseType)))
    .map((type) => EXERCISE_TYPE_BRIEFS[type])
    .join('\n\n');

  const order = slots
    .map((slot, index) => `${index + 1}. ${slot.exerciseType} (trudność ${slot.difficulty}/5)`)
    .join('\n');

  return `${renderContextForPrompt(context)}

---

${typeBriefs}

---

ZAMÓWIENIE — ułóż dokładnie ${slots.length} zadań, w tej kolejności i tych typach:
${order}

TWARDE ZASADY:
- Każde zadanie MUSI wynikać z materiału powyżej. Nie wolno wprowadzać nowego celu nauki.
- Każde zadanie ma DOKŁADNIE JEDEN główny cel w polu \`learningObjective\`.
- \`requiredMaterial\` to konkretne słowa lub konstrukcje z lekcji, których odpowiedź musi użyć.
- \`acceptedVariants\` musi zawierać realne, naturalne alternatywy. Pusta tablica tylko wtedy,
  gdy odpowiedź jest naprawdę jedna.
- \`hintSmall\` i \`hintLarge\` układasz zgodnie z opisem typu. To one będą pokazane
  przy próbie 2 i 3 — nie wolno w nich zdradzić całej odpowiedzi.
- \`sourceLessonIndex\` to numer lekcji (1, 2 lub 3), z której wzięty jest materiał.
- Nie powtarzaj tego samego celu w dwóch zadaniach, jeśli materiału starcza na różne.

FORMAT ODPOWIEDZI — obiekt JSON z jednym kluczem \`exercises\`, tablicą ${slots.length} obiektów:
{
  "exercises": [
    {
      "exerciseType": "micro_translation",
      "learningObjective": "krótki opis jednego celu",
      "content": "treść zadania",
      "instruction": "polecenie dla kursanta po polsku",
      "modelAnswer": "odpowiedź wzorcowa",
      "acceptedVariants": ["inna naturalna wersja"],
      "requiredMaterial": ["konstrukcja z lekcji"],
      "commonMistakes": ["typowy błąd przy tym zadaniu"],
      "hintSmall": "podpowiedź do próby 2",
      "hintLarge": "podpowiedź do próby 3",
      "sourceLessonIndex": 1,
      "errorType": "TYLKO dla fix_sentence — typ błędu z listy; w innych typach pomiń"
    }
  ]
}`;
};

export interface GenerateInput {
  context: AssembledContext;
  slots: PlannedSlot[];
  call: ModelCall;
}

export interface GenerateResult {
  drafts: DraftExercise[];
  modelUsed: string;
  /** Sloty, na które model nic sensownego nie zwrócił. */
  missingSlots: number;
}

/**
 * Jedno wywołanie na cały zestaw.
 *
 * Zapytanie per zadanie byłoby odporniejsze na błąd parsowania, ale
 * kosztowałoby N razy więcej i — co ważniejsze — model nie widziałby
 * pozostałych zadań, więc powtarzałby ten sam cel. Tutaj widzi całość
 * i sam rozkłada materiał.
 */
export const generateExercises = async (input: GenerateInput): Promise<GenerateResult> => {
  const response = await input.call({
    system: `${buildCoreSystemPrompt()}

Twoje zadanie: ułożyć ćwiczenia na podstawie materiału z odbytej lekcji.
Pracujesz wyłącznie na podanym materiale. Nie dodajesz nowych celów nauki.`,
    user: buildGeneratorPrompt(input.context, input.slots),
    taskName: 'hw-v2/generate',
    // Wyżej niż domyślna: zdania mają brzmieć żywo, a nie jak wariacje
    // jednego szablonu. Kontrolę nad sensem trzyma walidator, nie temperatura.
    temperature: 0.6,
  });

  const payload = response.data as { exercises?: unknown[] };
  const rawList = Array.isArray(payload?.exercises) ? payload.exercises : [];

  const drafts: DraftExercise[] = [];
  rawList.forEach((raw, index) => {
    const fallbackType = input.slots[index]?.exerciseType || input.slots[0].exerciseType;
    const draft = parseDraft(raw, fallbackType);
    if (draft) drafts.push(draft);
  });

  return {
    drafts,
    modelUsed: response.modelUsed,
    missingSlots: Math.max(0, input.slots.length - drafts.length),
  };
};

// ---------------------------------------------------------------------------
// Nadanie tożsamości
// ---------------------------------------------------------------------------

export interface FinalizeInput {
  draft: DraftExercise;
  slot: PlannedSlot;
  context: AssembledContext;
  teacherId: string;
  studentId?: string;
  groupId?: string;
  modelVersion: string;
  validation: ExerciseContractV2['validation'];
  requiresTeacherReview: boolean;
}

/**
 * Zamienia szkic w zamrożony kontrakt.
 *
 * Od tego momentu zadanie ma wersję schematu, promptu i modelu — bez nich
 * nie da się później odpowiedzieć na pytanie, czym właściwie oceniono
 * odpowiedź kursanta sprzed trzech miesięcy.
 */
export const finalizeContract = (input: FinalizeInput): ExerciseContractV2 => {
  const { draft, context } = input;
  const lessonIndex = Math.min(Math.max(1, draft.sourceLessonIndex), context.lessons.length) - 1;
  const lesson = context.lessons[lessonIndex] || context.lessons[0];

  return {
    id: randomUUID(),
    engineVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
    modelVersion: input.modelVersion,

    teacherId: input.teacherId,
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.groupId ? { groupId: input.groupId } : {}),

    mode: 'training',
    exerciseType: draft.exerciseType,
    responseMode: 'text',
    sourceLanguage: 'pl',
    targetLanguage: 'en',
    cefr: context.student.cefr,
    difficulty: input.slot.difficulty,

    learningObjective: draft.learningObjective,
    content: draft.content,
    instruction: draft.instruction || defaultInstruction(draft.exerciseType),
    modelAnswer: draft.modelAnswer,
    acceptedVariants: draft.acceptedVariants,
    requiredMaterial: draft.requiredMaterial,
    commonMistakes: draft.commonMistakes,

    hintSmall: draft.hintSmall || defaultHint(draft.exerciseType, 'small'),
    hintLarge: draft.hintLarge || defaultHint(draft.exerciseType, 'large'),

    sourceRefs: [
      {
        kind: 'lessonRecord',
        id: lesson.lessonId,
        block: 'vocabulary',
        label: 'lekcja',
      },
    ],
    validation: input.validation,
    requiresTeacherReview: input.requiresTeacherReview,
    createdAt: new Date().toISOString(),
  };
};

/** Polecenie zastępcze, gdy model go nie dał. Kursant nie może zostać bez instrukcji. */
const defaultInstruction = (type: ExerciseTypeV2): string => {
  if (type === 'micro_translation') return 'Przetłumacz zdanie na angielski, używając materiału z lekcji.';
  if (type === 'fix_sentence') return 'Popraw błąd i wpisz całe poprawne zdanie.';
  return 'Uzupełnij lukę jednym pasującym słowem lub frazą.';
};

/**
 * Podpowiedź zastępcza.
 *
 * Wyliczana z kontraktu, nie pytana u modelu — drabinka podpowiedzi jest
 * zamrożona i nie wolno jej oddać wolnemu AI (§3.1).
 */
const defaultHint = (type: ExerciseTypeV2, level: 'small' | 'large'): string => {
  if (type === 'micro_translation') {
    return level === 'small' ? 'Zacznij od konstrukcji z lekcji.' : 'Ułóż zdanie według wzoru z lekcji.';
  }
  if (type === 'fix_sentence') {
    return level === 'small' ? 'Błąd jest w jednym miejscu — poszukaj go.' : 'Błąd dotyczy konstrukcji z lekcji.';
  }
  return level === 'small' ? 'Brakuje jednego słowa z lekcji.' : 'To słowo pojawiło się w słownictwie lekcji.';
};

// ---------------------------------------------------------------------------
// Regeneracja (wsadowa — patrz uzasadnienie w `qualityValidator.ts:validateAll`)
// ---------------------------------------------------------------------------

export interface RegenerateBatchInput {
  context: AssembledContext;
  items: { draft: DraftExercise; failedChecks: string[] }[];
  call: ModelCall;
}

/**
 * Poprawia WSZYSTKIE nieudane zadania jednym wywołaniem modelu, znając
 * zarzuty walidatora dla każdego z nich — zamiast osobnego zapytania na
 * każde nieudane zadanie. Patrz uzasadnienie przy `validateAll` w
 * `qualityValidator.ts`: sekwencyjna regeneracja po jednym zadaniu na
 * zapytanie była głównym mnożnikiem 145-sekundowego opóźnienia przy złym
 * losowaniu (do dwóch regeneracji na każde z sześciu zadań, każda osobnym
 * zapytaniem).
 *
 * Cel i typ każdego zadania zostają zachowane z oryginału. Regeneracja ma
 * naprawić wykonanie, a nie podmienić zadanie na inne — inaczej lektor
 * traci pokrycie materiału, które zaplanował.
 */
export const regenerateBatch = async (input: RegenerateBatchInput): Promise<(DraftExercise | null)[]> => {
  if (input.items.length === 0) return [];

  const typeBriefs = Array.from(new Set(input.items.map((item) => item.draft.exerciseType)))
    .map((type) => EXERCISE_TYPE_BRIEFS[type])
    .join('\n\n');

  const itemsBlock = input.items
    .map(
      (item, i) => `ZADANIE #${i + 1}, KTÓRE NIE PRZESZŁO:
${JSON.stringify(
  {
    exerciseType: item.draft.exerciseType,
    learningObjective: item.draft.learningObjective,
    content: item.draft.content,
    instruction: item.draft.instruction,
    modelAnswer: item.draft.modelAnswer,
    acceptedVariants: item.draft.acceptedVariants,
    requiredMaterial: item.draft.requiredMaterial,
    hintSmall: item.draft.hintSmall,
    hintLarge: item.draft.hintLarge,
    ...(item.draft.errorType ? { errorType: item.draft.errorType } : {}),
  },
  null,
  2
)}
ZARZUTY KONTROLERA: ${item.failedChecks.length > 0 ? item.failedChecks.join(', ') : 'ogólnie za słabe'}`
    )
    .join('\n\n---\n\n');

  const response = await input.call({
    system: `${buildCoreSystemPrompt()}

Twoje zadanie: poprawić ${input.items.length} ${
      input.items.length === 1 ? 'ćwiczenie' : 'ćwiczeń'
    }, które nie przeszły kontroli jakości.
Zachowujesz ten sam typ i ten sam cel nauki KAŻDEGO zadania. Naprawiasz wykonanie, nie wymyślasz nowe zadanie.`,
    user: `${renderContextForPrompt(input.context)}

---

${typeBriefs}

---

${itemsBlock}

---

Ułóż KAŻDE z powyższych ${input.items.length} zadań od nowa tak, żeby jego zarzuty przestały
obowiązywać. Zachowaj \`exerciseType\` i \`learningObjective\` każdego zadania.

FORMAT ODPOWIEDZI — obiekt JSON z kluczem \`results\`, dokładnie ${input.items.length} obiektów,
\`index\` odpowiada numerowi zadania powyżej (1-based), reszta pól jak w oryginalnym zadaniu
(uzupełnione o \`commonMistakes\` i \`sourceLessonIndex\`; w \`fix_sentence\` także \`errorType\`):
{ "results": [ { "index": 1, "exerciseType": "...", "learningObjective": "...", "content": "...", "instruction": "...", "modelAnswer": "...", "acceptedVariants": [], "requiredMaterial": [], "commonMistakes": [], "hintSmall": "...", "hintLarge": "...", "sourceLessonIndex": 1 } ] }`,
    taskName: 'hw-v2/regenerate-batch',
    temperature: 0.6,
  });

  const payload = response.data as { results?: unknown[] };
  const rawList = Array.isArray(payload?.results) ? payload.results : [];

  return input.items.map((item, i) => {
    const byIndex = rawList.find((r) => Number((r as Record<string, unknown>)?.index) === i + 1);
    const raw = byIndex ?? rawList[i];
    const parsed = raw ? parseDraft(raw, item.draft.exerciseType) : null;
    if (!parsed) return null;

    // Cel i typ trzymamy z oryginału — model bywa kreatywny tam, gdzie nie prosimy.
    return { ...parsed, exerciseType: item.draft.exerciseType, learningObjective: item.draft.learningObjective };
  });
};
