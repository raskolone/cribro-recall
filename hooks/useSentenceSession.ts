import { useCallback, useMemo, useState } from 'react';
import {
  SentenceSession,
  MaybeStamped,
  exerciseId,
  answersView,
  hintsView,
  resultsView,
  statusesView,
  withAnswer,
  withEvaluating,
  withHintToggled,
  withResult,
  withResultOnly,
  withoutEvaluating,
  withoutEvaluation,
} from '../utils/sentenceSession';

/**
 * Odpowiedzi, wskazówki, statusy i wyniki zdań ćwiczenia, kluczowane `id` zadania (patrz
 * `utils/sentenceSession.ts`). Zwraca widoki po indeksie, żeby ekran dalej czytał „zdanie nr i",
 * a zapisy kierował przez id zadania — nowa runda zadań (nowe id) zaczyna z czystym stanem.
 */
export function useSentenceSession<R>(exercises: ReadonlyArray<MaybeStamped>) {
  const [session, setSession] = useState<SentenceSession<R>>({});

  const answers = useMemo(() => answersView(exercises, session), [exercises, session]);
  const hints = useMemo(() => hintsView(exercises, session), [exercises, session]);
  const statuses = useMemo(() => statusesView(exercises, session), [exercises, session]);
  const results = useMemo(() => resultsView(exercises, session), [exercises, session]);

  const idAt = useCallback((index: number) => exerciseId(exercises[index]), [exercises]);

  const setAnswer = useCallback((index: number, value: string) => {
    const id = idAt(index);
    if (id) setSession((prev) => withAnswer(prev, id, value));
  }, [idAt]);

  const toggleHint = useCallback((index: number) => {
    const id = idAt(index);
    if (id) setSession((prev) => withHintToggled(prev, id));
  }, [idAt]);

  /** Oznacza zdanie jako sprawdzane i zwraca jego id — wynik wraca pod TO id, nawet gdy kursant zdążył przejść dalej. */
  const beginEvaluation = useCallback((index: number): string | undefined => {
    const id = idAt(index);
    if (id) setSession((prev) => withEvaluating(prev, id));
    return id;
  }, [idAt]);

  const completeEvaluation = useCallback((id: string, result: R) => {
    setSession((prev) => withResult(prev, id, result));
  }, []);

  const failEvaluation = useCallback((id: string) => {
    setSession((prev) => withoutEvaluating(prev, id));
  }, []);

  const clearEvaluation = useCallback((index: number) => {
    const id = idAt(index);
    if (id) setSession((prev) => withoutEvaluation(prev, id));
  }, [idAt]);

  /** Sam wynik, bez zmiany statusu (układanka). */
  const setResult = useCallback((index: number, result: R) => {
    const id = idAt(index);
    if (id) setSession((prev) => withResultOnly(prev, id, result));
  }, [idAt]);

  /** Zapis zbiorczy po „Zakończ": wyniki po indeksie, status „sprawdzone" tylko dla wskazanych zdań. */
  const applyResults = useCallback((byIndex: Record<number, R>, evaluatedIndices: ReadonlyArray<number>) => {
    setSession((prev) => {
      let next = prev;
      Object.entries(byIndex).forEach(([key, result]) => {
        const index = Number(key);
        const id = idAt(index);
        if (!id || result === undefined) return;
        next = evaluatedIndices.includes(index) ? withResult(next, id, result) : withResultOnly(next, id, result);
      });
      return next;
    });
  }, [idAt]);

  const reset = useCallback(() => setSession({}), []);

  return { answers, hints, statuses, results, setAnswer, toggleHint, beginEvaluation, completeEvaluation, failEvaluation, clearEvaluation, setResult, applyResults, reset };
}
