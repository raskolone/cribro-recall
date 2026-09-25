/**
 * QualityValidator — żelazna kontrola naturalności.
 *
 * Osobne wywołanie modelu, nigdy ten sam przebieg co generator. Powód jest
 * prosty i sprawdzony: model poproszony w jednym zapytaniu o ułożenie zadania
 * i ocenę własnego zadania zawsze ocenia je dobrze.
 *
 * Zadanie, które nie przechodzi, jest regenerowane najwyżej dwa razy.
 * Potem dostaje `requiresTeacherReview` i NIE MOŻE zostać automatycznie
 * przypisane kursantowi (§10).
 */

import { AssembledContext, renderContextForPrompt } from './contextAssembler';
import { MAX_REGENERATIONS, ValidationResultV2 } from './contracts';
import { FIX_SENTENCE_ERROR_TYPES, VALIDATOR_CHECKS, buildCoreSystemPrompt } from './coreKnowledge';
import { DraftExercise } from './exerciseGenerator';
import { ModelCall } from './openai';

/**
 * Próg przepuszczenia.
 *
 * Zadanie musi przejść wszystkie dziesięć pytań; `score` jest miarą
 * pomocniczą dla lektora („jak blisko było"), a nie drugą bramką.
 * Zostawiony próg chroni przed modelem, który odpowiada „przeszło"
 * i jednocześnie wypisuje listę zarzutów.
 */
export const VALIDATION_PASS_THRESHOLD = 0.7;

export interface ValidatedDraft {
  draft: DraftExercise;
  validation: ValidationResultV2;
  /** Po wyczerpaniu regeneracji — zadanie idzie do lektora, nie do kursanta. */
  requiresTeacherReview: boolean;
}

interface RawVerdict {
  passed?: unknown;
  score?: unknown;
  failedChecks?: unknown;
  notes?: unknown;
}

const buildValidatorPrompt = (context: AssembledContext, draft: DraftExercise): string =>
  `${renderContextForPrompt(context)}

---

${VALIDATOR_CHECKS}

---

ZADANIE DO SPRAWDZENIA:
{
  "exerciseType": ${JSON.stringify(draft.exerciseType)},
  "learningObjective": ${JSON.stringify(draft.learningObjective)},
  "content": ${JSON.stringify(draft.content)},
  "instruction": ${JSON.stringify(draft.instruction)},
  "modelAnswer": ${JSON.stringify(draft.modelAnswer)},
  "acceptedVariants": ${JSON.stringify(draft.acceptedVariants)},
  "requiredMaterial": ${JSON.stringify(draft.requiredMaterial)},
  "hintSmall": ${JSON.stringify(draft.hintSmall)},
  "hintLarge": ${JSON.stringify(draft.hintLarge)}
}

FORMAT ODPOWIEDZI (JSON):
{
  "passed": true,
  "score": 0.9,
  "failedChecks": [],
  "notes": "jedno zdanie dla lektora, po polsku"
}

\`failedChecks\` zawiera nazwy pytań, które wypadły źle — dokładnie tak, jak nazwano je wyżej
(np. "naturalness_pl", "single_goal"). Jeśli zadanie jest dobre, tablica jest pusta.`;

/**
 * Nadaje surowej odpowiedzi modelu kształt werdyktu — bez modelu, bez sieci.
 *
 * Wspólne dla ścieżki pojedynczej (`validateDraft`) i wsadowej
 * (`validateBatch`), żeby próg przepuszczenia i reguła "zarzuty biją
 * deklarację" liczyły się dokładnie tak samo w obu miejscach.
 */
const shapeVerdict = (
  raw: RawVerdict,
  regenerationCount: number,
  modelVersion: string
): ValidationResultV2 => {
  const failedChecks = Array.isArray(raw.failedChecks)
    ? raw.failedChecks.filter((c): c is string => typeof c === 'string')
    : [];

  const rawScore = typeof raw.score === 'number' ? raw.score : 0;
  const score = Math.min(1, Math.max(0, rawScore));

  // Model bywa niekonsekwentny: deklaruje `passed: true` i jednocześnie
  // wypisuje zarzuty. Rozstrzyga lista zarzutów i próg, nie deklaracja.
  const passed = raw.passed === true && failedChecks.length === 0 && score >= VALIDATION_PASS_THRESHOLD;

  return {
    passed,
    score,
    failedChecks,
    regenerationCount,
    modelVersion,
    checkedAt: new Date().toISOString(),
  };
};

/**
 * Postać zdania do porównań — lustrzana kopia `normalizeSentence`
 * z `utils/exerciseSentenceChecks.ts` (zgodność: `tests/cribroSentenceRules.test.ts`).
 */
export const normalizeSentence = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC`\u00B4]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Zarzuty, których nie trzeba pytać model — wynikają z samych danych.
 *
 * `fix_sentence`, w którym zdanie „z błędem" jest po normalizacji takie samo
 * jak odpowiedź wzorcowa (albo jeden z wariantów), jest nierozwiązywalne:
 * kursant przepisze je bez zmian i dostanie ocenę za nic. Model-kontroler
 * potrafi takie zadanie przepuścić, więc ten zarzut ma pierwszeństwo przed
 * jego werdyktem i kieruje zadanie do zwykłej regeneracji.
 */
export const deterministicFailedChecks = (draft: DraftExercise): string[] => {
  if (draft.exerciseType !== 'fix_sentence') return [];

  const failed: string[] = [];
  const errorSentence = normalizeSentence(draft.content);
  const correctForms = [draft.modelAnswer, ...draft.acceptedVariants].map(normalizeSentence);
  if (correctForms.includes(errorSentence)) failed.push('fix_sentence_has_no_error');

  if (!draft.errorType || !(FIX_SENTENCE_ERROR_TYPES as readonly string[]).includes(draft.errorType)) {
    failed.push('fix_sentence_missing_error_type');
  }
  return failed;
};

/** Dokłada zarzuty deterministyczne do werdyktu modelu — one zawsze przesądzają o porażce. */
const withDeterministicChecks = (draft: DraftExercise, verdict: ValidationResultV2): ValidationResultV2 => {
  const failed = deterministicFailedChecks(draft);
  if (failed.length === 0) return verdict;
  return {
    ...verdict,
    passed: false,
    failedChecks: [...failed, ...verdict.failedChecks.filter((c) => !failed.includes(c))],
  };
};

/** Jedno sprawdzenie jednego zadania — jedno wywołanie modelu. */
export const validateDraft = async (
  context: AssembledContext,
  draft: DraftExercise,
  call: ModelCall,
  regenerationCount: number
): Promise<ValidationResultV2> => {
  const response = await call({
    system: `${buildCoreSystemPrompt()}

Twoja rola: niezależny kontroler jakości ćwiczeń językowych.
Nie układasz zadań. Oceniasz cudze. Jesteś surowy i konkretny.`,
    user: buildValidatorPrompt(context, draft),
    taskName: 'hw-v2/validate',
    // Ocena ma być powtarzalna — to samo zadanie ma dostać ten sam werdykt.
    temperature: 0,
  });

  return withDeterministicChecks(
    draft,
    shapeVerdict((response.data || {}) as RawVerdict, regenerationCount, response.modelUsed)
  );
};

// ---------------------------------------------------------------------------
// Wsadowa kontrola — cały zestaw jednym zapytaniem
// ---------------------------------------------------------------------------

interface RawBatchVerdict extends RawVerdict {
  index?: unknown;
}

const buildBatchValidatorPrompt = (context: AssembledContext, drafts: DraftExercise[]): string => {
  const items = drafts
    .map(
      (draft, i) => `ZADANIE #${i + 1}:
{
  "exerciseType": ${JSON.stringify(draft.exerciseType)},
  "learningObjective": ${JSON.stringify(draft.learningObjective)},
  "content": ${JSON.stringify(draft.content)},
  "instruction": ${JSON.stringify(draft.instruction)},
  "modelAnswer": ${JSON.stringify(draft.modelAnswer)},
  "acceptedVariants": ${JSON.stringify(draft.acceptedVariants)},
  "requiredMaterial": ${JSON.stringify(draft.requiredMaterial)},
  "hintSmall": ${JSON.stringify(draft.hintSmall)},
  "hintLarge": ${JSON.stringify(draft.hintLarge)}
}`
    )
    .join('\n\n');

  return `${renderContextForPrompt(context)}

---

${VALIDATOR_CHECKS}

---

DO SPRAWDZENIA — ${drafts.length} zadań. Oceń KAŻDE z osobna, niezależnie od pozostałych:

${items}

FORMAT ODPOWIEDZI (JSON) — jeden obiekt z kluczem \`results\`, dokładnie ${drafts.length}
wpisów, \`index\` odpowiada numerowi zadania powyżej (1-based):
{
  "results": [
    { "index": 1, "passed": true, "score": 0.9, "failedChecks": [], "notes": "jedno zdanie dla lektora, po polsku" }
  ]
}

\`failedChecks\` zawiera nazwy pytań, które wypadły źle — dokładnie tak, jak nazwano je wyżej
(np. "naturalness_pl", "single_goal"). Jeśli zadanie jest dobre, tablica jest pusta.`;
};

/**
 * Sprawdza CAŁY zestaw jednym wywołaniem modelu.
 *
 * To jest naprawa przyczyny 145 s na 6 zadań: wcześniej `validateAll` pytał
 * model osobno o każde zadanie, sekwencyjnie (`for...of` + `await`) — sześć
 * pełnych, zależnych od siebie w czasie zapytań HTTP zamiast jednego.
 * Model widzi tu wszystkie zadania naraz i ocenia je w jednym przebiegu,
 * dokładnie tak samo, jak generator już układa cały zestaw w jednym strzale.
 */
export const validateBatch = async (
  context: AssembledContext,
  drafts: DraftExercise[],
  call: ModelCall,
  regenerationCounts: number[]
): Promise<ValidationResultV2[]> => {
  if (drafts.length === 0) return [];

  const response = await call({
    system: `${buildCoreSystemPrompt()}

Twoja rola: niezależny kontroler jakości ćwiczeń językowych.
Nie układasz zadań. Oceniasz cudze. Jesteś surowy i konkretny.`,
    user: buildBatchValidatorPrompt(context, drafts),
    taskName: 'hw-v2/validate-batch',
    temperature: 0,
  });

  const payload = response.data as { results?: unknown[] };
  const rawList = Array.isArray(payload?.results) ? (payload.results as RawBatchVerdict[]) : [];

  return drafts.map((_, i) => {
    // Dopasowanie po `index` modelu, z awaryjnym powrotem do pozycji w
    // tablicy — model potrafi zwrócić listę bez pola `index`, mimo że
    // prompt o nie prosi.
    const byIndex = rawList.find((r) => Number(r?.index) === i + 1);
    const raw = byIndex ?? rawList[i] ?? {};
    return withDeterministicChecks(drafts[i], shapeVerdict(raw, regenerationCounts[i] ?? 0, response.modelUsed));
  });
};

export interface ValidateAllInput {
  context: AssembledContext;
  drafts: DraftExercise[];
  call: ModelCall;
  /**
   * Poprawia WSZYSTKIE nieudane zadania jednym wywołaniem modelu (patrz
   * `regenerateBatch` w `exerciseGenerator.ts`). Zwraca `null` na pozycji
   * zadania, którego nie dało się poprawić — tak jak dawne `regenerate`
   * dla pojedynczego zadania.
   */
  regenerateBatch: (
    items: { draft: DraftExercise; failedChecks: string[] }[]
  ) => Promise<(DraftExercise | null)[]>;
}

/**
 * Sprawdza cały zestaw, regenerując to, co nie przeszło.
 *
 * Wcześniej: pętla `for` po zadaniach, z osobnym wywołaniem modelu na
 * walidację i osobnym na każdą regenerację KAŻDEGO zadania — dla zestawu
 * sześciu zadań, przy pechu, nawet 1 + 6 + 2×6×2 = 31 sekwencyjnych zapytań.
 * Stąd 145 s zamiast kilku sekund.
 *
 * Teraz: jedno zapytanie ocenia CAŁY zestaw naraz (`validateBatch`), a każda
 * z najwyżej dwóch rund regeneracji też jest jednym zapytaniem obejmującym
 * WSZYSTKIE zadania, które akurat nie przeszły (`regenerateBatch`) —
 * niezależnie od tego, ile ich jest. Górny limit to teraz 1 (walidacja) +
 * 2 × 2 (regeneracja + ponowna walidacja) = 5 zapytań dla całego zestawu,
 * zamiast 5 na SZTUKĘ.
 *
 * Limit dwóch rund regeneracji jest twardy — trzecie podejście do tego
 * samego zadania w praktyce kończy się tak samo, jeśli materiał, nie pech,
 * jest problemem. Wtedy decyzja należy do lektora.
 */
export const validateAll = async (input: ValidateAllInput): Promise<ValidatedDraft[]> => {
  const drafts = [...input.drafts];
  const regenerationCounts = drafts.map(() => 0);
  const validations = await validateBatch(input.context, drafts, input.call, regenerationCounts);

  for (let round = 0; round < MAX_REGENERATIONS; round++) {
    const failingIndices = validations
      .map((v, i) => (v.passed ? -1 : i))
      .filter((i) => i !== -1);

    if (failingIndices.length === 0) break;

    const regenerated = await input.regenerateBatch(
      failingIndices.map((i) => ({ draft: drafts[i], failedChecks: validations[i].failedChecks }))
    );

    // Tylko zadania, które faktycznie dostały nową wersję, wracają do
    // walidacji w tej rundzie — reszta zostaje przy ostatnim znanym werdykcie.
    const reValidateIndices: number[] = [];
    failingIndices.forEach((originalIndex, k) => {
      const newDraft = regenerated[k];
      if (newDraft) {
        drafts[originalIndex] = newDraft;
        regenerationCounts[originalIndex] += 1;
        reValidateIndices.push(originalIndex);
      }
    });

    if (reValidateIndices.length === 0) break;

    const revalidated = await validateBatch(
      input.context,
      reValidateIndices.map((i) => drafts[i]),
      input.call,
      reValidateIndices.map((i) => regenerationCounts[i])
    );

    reValidateIndices.forEach((originalIndex, k) => {
      validations[originalIndex] = revalidated[k];
    });
  }

  return drafts.map((draft, i) => ({
    draft,
    validation: validations[i],
    requiresTeacherReview: !validations[i].passed,
  }));
};
