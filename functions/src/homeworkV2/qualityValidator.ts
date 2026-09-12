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
import { VALIDATOR_CHECKS, buildCoreSystemPrompt } from './coreKnowledge';
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

/** Jedno sprawdzenie jednego zadania. */
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

  const verdict = (response.data || {}) as RawVerdict;

  const failedChecks = Array.isArray(verdict.failedChecks)
    ? verdict.failedChecks.filter((c): c is string => typeof c === 'string')
    : [];

  const rawScore = typeof verdict.score === 'number' ? verdict.score : 0;
  const score = Math.min(1, Math.max(0, rawScore));

  // Model bywa niekonsekwentny: deklaruje `passed: true` i jednocześnie
  // wypisuje zarzuty. Rozstrzyga lista zarzutów i próg, nie deklaracja.
  const passed = verdict.passed === true && failedChecks.length === 0 && score >= VALIDATION_PASS_THRESHOLD;

  return {
    passed,
    score,
    failedChecks,
    regenerationCount,
    modelVersion: response.modelUsed,
    checkedAt: new Date().toISOString(),
  };
};

export interface ValidateAllInput {
  context: AssembledContext;
  drafts: DraftExercise[];
  call: ModelCall;
  /** Wywoływane, gdy zadanie trzeba ułożyć od nowa. */
  regenerate: (draft: DraftExercise, failedChecks: string[]) => Promise<DraftExercise | null>;
}

/**
 * Sprawdza cały zestaw, regenerując to, co nie przeszło.
 *
 * Limit dwóch regeneracji jest twardy. Trzecie podejście do tego samego
 * zadania kosztuje kolejne dwa wywołania modelu i w praktyce kończy się tak
 * samo — jeśli model dwa razy nie potrafił, problemem jest materiał, a nie
 * pech. Wtedy decyzja należy do lektora.
 */
export const validateAll = async (input: ValidateAllInput): Promise<ValidatedDraft[]> => {
  const results: ValidatedDraft[] = [];

  for (const originalDraft of input.drafts) {
    let draft = originalDraft;
    let validation = await validateDraft(input.context, draft, input.call, 0);

    let attempts = 0;
    while (!validation.passed && attempts < MAX_REGENERATIONS) {
      attempts += 1;
      const regenerated = await input.regenerate(draft, validation.failedChecks);
      if (!regenerated) break;
      draft = regenerated;
      validation = await validateDraft(input.context, draft, input.call, attempts);
    }

    results.push({
      draft,
      validation,
      requiresTeacherReview: !validation.passed,
    });
  }

  return results;
};
