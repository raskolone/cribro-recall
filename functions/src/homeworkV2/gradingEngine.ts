/**
 * GradingEngine — ocena odpowiedzi według zamrożonego kontraktu.
 *
 * Model wystawia wyłącznie trzy oceny obszarowe i pewność. Wszystko dalej —
 * wynik ważony, stan opanowania, decyzja o oddaniu sprawy lektorowi — liczy
 * czysta funkcja z `contracts.ts`. To jest sedno zdania „rubryka ważniejsza
 * niż doraźna opinia modelu" (§18): model nie ma prawa ogłosić `opanowane`,
 * może tylko powiedzieć, co widzi w trzech obszarach.
 *
 * Ocena powstaje wyłącznie tutaj, po stronie Cloud Functions. Kursant nie
 * zapisuje werdyktu — w v1 mógł i to jest odnotowane w audycie jako dług.
 */

import {
  AreaScore,
  AttemptNumber,
  ExerciseContractV2,
  GradingVerdictV2,
  MasteryState,
  RubricArea,
  RubricScores,
  SCHEMA_VERSION,
  isRubricScores,
  resolveMastery,
  weightedScore,
} from './contracts';
import { RUBRIC_BRIEF, buildCoreSystemPrompt } from './coreKnowledge';
import { ModelCall } from './openai';

export interface GradeInput {
  contract: ExerciseContractV2;
  answer: string;
  attemptNumber: AttemptNumber;
  isCorrectionAfterModelAnswer: boolean;
  previousState: MasteryState;
  call: ModelCall;
}

/** Zaokrągla cokolwiek do najbliższej dozwolonej oceny obszaru. */
const snapToAreaScore = (value: unknown): AreaScore => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n >= 0.75) return 1;
  if (n >= 0.25) return 0.5;
  return 0;
};

const buildGradingPrompt = (contract: ExerciseContractV2, answer: string, attemptNumber: number): string =>
  `ZADANIE:
Typ: ${contract.exerciseType}
Cel nauki: ${contract.learningObjective}
Treść: ${contract.content}
Polecenie: ${contract.instruction}

ODPOWIEDŹ WZORCOWA: ${contract.modelAnswer}
WARIANTY UZNAWANE ZA PEŁNOPRAWNE: ${
    contract.acceptedVariants.length > 0 ? JSON.stringify(contract.acceptedVariants) : '(brak — wzorzec jest jeden)'
  }
MATERIAŁ, KTÓRY MUSI SIĘ POJAWIĆ: ${JSON.stringify(contract.requiredMaterial)}
POZIOM KURSANTA: ${contract.cefr}

ODPOWIEDŹ KURSANTA (próba ${attemptNumber}):
"""
${answer}
"""

---

${RUBRIC_BRIEF}

---

FORMAT ODPOWIEDZI (JSON):
{
  "meaning": 1,
  "targetMaterial": 1,
  "accuracy": 0.5,
  "confidence": 0.85,
  "rationale": {
    "meaning": "jedno zdanie po polsku",
    "targetMaterial": "jedno zdanie po polsku",
    "accuracy": "jedno zdanie po polsku"
  }
}

Każda z trzech ocen to dokładnie 0, 0.5 albo 1. Nic pomiędzy.`;

/**
 * Ocenia jedną odpowiedź.
 *
 * Przy awarii modelu NIE zgadujemy i nie karzemy: zwracamy werdykt z zerową
 * pewnością, co przez `resolveMastery` zostawia stan bez zmiany i kieruje
 * sprawę do lektora. Kursant nie może stracić postępu dlatego, że OpenAI
 * miało gorszą minutę.
 */
export const gradeAttempt = async (input: GradeInput): Promise<GradingVerdictV2> => {
  const { contract, answer, attemptNumber } = input;

  let scores: RubricScores;
  let confidence: number;
  let rationale: Record<RubricArea, string>;
  let modelVersion: string;

  try {
    const response = await input.call({
      system: `${buildCoreSystemPrompt()}

Twoja rola: sprawiedliwy oceniający. Oceniasz wyłącznie według podanej rubryki.
Nie doradzasz, nie uczysz, nie piszesz feedbacku — od tego jest osobny krok.`,
      user: buildGradingPrompt(contract, answer, attemptNumber),
      taskName: 'hw-v2/grade',
      // Zero: ta sama odpowiedź ma dostać tę samą ocenę dziś i za miesiąc.
      temperature: 0,
    });

    const raw = (response.data || {}) as Record<string, unknown>;
    const candidate = {
      meaning: snapToAreaScore(raw.meaning),
      targetMaterial: snapToAreaScore(raw.targetMaterial),
      accuracy: snapToAreaScore(raw.accuracy),
    };

    if (!isRubricScores(candidate)) throw new Error('Model zwrócił oceny spoza skali.');

    scores = candidate;
    const rawConfidence = typeof raw.confidence === 'number' ? raw.confidence : 0;
    confidence = Math.min(1, Math.max(0, rawConfidence));

    const rawRationale = (raw.rationale || {}) as Record<string, unknown>;
    rationale = {
      meaning: String(rawRationale.meaning || ''),
      targetMaterial: String(rawRationale.targetMaterial || ''),
      accuracy: String(rawRationale.accuracy || ''),
    };
    modelVersion = response.modelUsed;
  } catch {
    scores = { meaning: 0, targetMaterial: 0, accuracy: 0 };
    confidence = 0;
    rationale = {
      meaning: 'Ocena niedostępna — sprawa skierowana do lektora.',
      targetMaterial: '',
      accuracy: '',
    };
    modelVersion = 'unavailable';
  }

  const mastery = resolveMastery({
    scores,
    confidence,
    attemptNumber: input.attemptNumber,
    isCorrectionAfterModelAnswer: input.isCorrectionAfterModelAnswer,
    previousState: input.previousState,
  });

  return {
    rubricScores: scores,
    weightedScore: weightedScore(scores),
    confidence,
    rationale,
    masteryState: mastery.state,
    requiresTeacherReview: mastery.requiresTeacherReview,
    schemaVersion: SCHEMA_VERSION,
    modelVersion,
    gradedAt: new Date().toISOString(),
  };
};
