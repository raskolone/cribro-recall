/**
 * FeedbackComposer — krótki komunikat Asystenta Cribro.
 *
 * Osobno od oceny, i to celowo. Model, który w jednym zapytaniu wystawia
 * punkty i pisze pociechę, zaczyna dopasowywać jedno do drugiego — podnosi
 * ocenę, żeby feedback brzmiał spójnie. Rozdzielenie kosztuje jedno wywołanie
 * i kupuje uczciwą punktację.
 *
 * Kursant NIE dostaje tu procentu ani słupka. Dostaje słowa i stan (§3.1).
 */

import {
  AttemptNumber,
  ExerciseContractV2,
  GradingVerdictV2,
  MAX_ATTEMPTS,
  MasteryState,
  hintForAttempt,
} from './contracts';
import { ASSISTANT_IDENTITY, FEEDBACK_STYLE } from './coreKnowledge';
import { ModelCall } from './openai';

export interface FeedbackInput {
  contract: ExerciseContractV2;
  verdict: GradingVerdictV2;
  answer: string;
  attemptNumber: AttemptNumber;
  call: ModelCall;
}

export interface StudentFeedback {
  /** Tekst dla kursanta. Bez procentów, bez wyliczanki błędów. */
  message: string;
  /** Stan do pokazania jako etykieta. */
  masteryState: MasteryState;
  /** Podpowiedź na następną próbę — z kontraktu, nie od modelu. */
  nextHint: string | null;
  /** Czy pokazujemy wzorzec i żądamy poprawionej wersji. */
  revealModelAnswer: boolean;
  /** Wzorzec, wyłącznie gdy `revealModelAnswer`. */
  modelAnswer?: string;
  /** Czy zostały jeszcze próby. */
  attemptsLeft: number;
}

/** Zapasowy komunikat, gdy model milczy. Kursant nie może zostać z pustym ekranem. */
const fallbackMessage = (state: MasteryState): string => {
  if (state === 'opanowane') return 'Dobra robota — to zadanie masz opanowane. Idziemy dalej.';
  return 'Zapisałem Twoją odpowiedź. Wrócimy do tego materiału przy powtórce.';
};

export const composeFeedback = async (input: FeedbackInput): Promise<StudentFeedback> => {
  const { contract, verdict, attemptNumber } = input;

  const revealModelAnswer = attemptNumber >= MAX_ATTEMPTS;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptNumber);

  // Podpowiedź na NASTĘPNĄ próbę — zamrożona, prosto z kontraktu.
  // Model nie ma prawa jej wymyślić (§3.1).
  const nextHint =
    attemptsLeft > 0
      ? hintForAttempt(contract, Math.min(attemptNumber + 1, MAX_ATTEMPTS) as AttemptNumber).text
      : null;

  let message: string;

  try {
    const response = await input.call({
      system: `${ASSISTANT_IDENTITY}

${FEEDBACK_STYLE}`,
      user: `ZADANIE: ${contract.content}
CEL NAUKI: ${contract.learningObjective}
ODPOWIEDŹ WZORCOWA: ${contract.modelAnswer}
POZIOM KURSANTA: ${contract.cefr}

ODPOWIEDŹ KURSANTA (próba ${attemptNumber} z ${MAX_ATTEMPTS}):
"""
${input.answer}
"""

OCENA OBSZAROWA (do Twojej wiadomości — NIE podawaj jej kursantowi):
- znaczenie: ${verdict.rubricScores.meaning} — ${verdict.rationale.meaning}
- materiał docelowy: ${verdict.rubricScores.targetMaterial} — ${verdict.rationale.targetMaterial}
- poprawność: ${verdict.rubricScores.accuracy} — ${verdict.rationale.accuracy}
- stan: ${verdict.masteryState}

${
  revealModelAnswer
    ? 'To była ostatnia próba. Kursant zobaczy wzorzec i ma napisać poprawioną wersję. Zachęć go do tego jednym zdaniem.'
    : `Kursantowi zostały jeszcze ${attemptsLeft} próby. NIE podawaj odpowiedzi ani jej fragmentu — podpowiedź pokaże system osobno.`
}

Napisz komunikat do kursanta. Maksymalnie 4 krótkie zdania.
Zwróć JSON: { "message": "..." }`,
      taskName: 'hw-v2/feedback',
      temperature: 0.4,
    });

    const raw = (response.data || {}) as { message?: unknown };
    message = typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim() : fallbackMessage(verdict.masteryState);
  } catch {
    message = fallbackMessage(verdict.masteryState);
  }

  return {
    message,
    masteryState: verdict.masteryState,
    nextHint,
    revealModelAnswer,
    ...(revealModelAnswer ? { modelAnswer: contract.modelAnswer } : {}),
    attemptsLeft,
  };
};
