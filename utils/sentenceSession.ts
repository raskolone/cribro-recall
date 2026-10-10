/**
 * Stan zdań w ćwiczeniu (odpowiedź, wskazówka, status sprawdzania, wynik) trzymany PO ID ZADANIA.
 *
 * Wcześniej odpowiedzi, statusy i wyniki żyły w tablicach / mapach po indeksie zdania. Nowa runda
 * zdań ("Generuj kolejne zdania", "Nowy trening") zerowała odpowiedzi, ale nie statusy i wyniki,
 * więc stary wynik z indeksu 3 przyklejał się do nowego zdania 4: widok pokazywał cudzą odpowiedź
 * i cudzy feedback w miejscu pola, a zapis podsumowania brał stare wyniki. Klucz po id, nadawanym
 * przy KAŻDYM wprowadzeniu zadań do ćwiczenia, odcina jedną rundę od drugiej z założenia.
 */

export type EvaluationStatus = 'evaluating' | 'evaluated';

export interface SentenceSlot<R> {
  answer: string;
  hintOpen: boolean;
  status?: EvaluationStatus;
  result?: R;
}

export type SentenceSession<R> = Record<string, SentenceSlot<R>>;

/** Zadanie, z którego da się odczytać id nadane przez `stampExercises` (inne `id`, np. liczbowe z generatora, ignorujemy). */
export type MaybeStamped = object;

export const exerciseId = (exercise: MaybeStamped | undefined): string | undefined => {
  const id = (exercise as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' ? id : undefined;
};

const EMPTY_SLOT: SentenceSlot<never> = Object.freeze({ answer: '', hintOpen: false });

let counter = 0;

/**
 * Kopie zadań z NOWYMI id. Zawsze nadpisuje `id` — to samo zadanie wprowadzone drugi raz (np. zadania
 * lektora, ten sam obiekt w stanie nadrzędnym, albo zadanie z cache) jest nową próbą i nie dziedziczy
 * niczego po poprzedniej.
 */
export function stampExercises<T extends object>(list: ReadonlyArray<T>): Array<Omit<T, 'id'> & { id: string }> {
  return list.map((exercise) => ({ ...exercise, id: `ex-${++counter}` }));
}

export const slotOf = <R>(session: SentenceSession<R>, id: string | undefined): SentenceSlot<R> =>
  (id !== undefined && session[id]) || (EMPTY_SLOT as SentenceSlot<R>);

const update = <R>(session: SentenceSession<R>, id: string, patch: (slot: SentenceSlot<R>) => SentenceSlot<R>): SentenceSession<R> => ({
  ...session,
  [id]: patch(slotOf(session, id)),
});

export const withAnswer = <R>(session: SentenceSession<R>, id: string, answer: string) =>
  update(session, id, (slot) => ({ ...slot, answer }));

export const withHintToggled = <R>(session: SentenceSession<R>, id: string) =>
  update(session, id, (slot) => ({ ...slot, hintOpen: !slot.hintOpen }));

export const withEvaluating = <R>(session: SentenceSession<R>, id: string) =>
  update(session, id, (slot) => ({ ...slot, status: 'evaluating' as const }));

/** Wynik sprawdzenia: zdanie jest „sprawdzone" i ma wynik. */
export const withResult = <R>(session: SentenceSession<R>, id: string, result: R) =>
  update(session, id, (slot) => ({ ...slot, result, status: 'evaluated' as const }));

/** Sam wynik, bez zmiany statusu (np. układanka, domyślny wynik „brak odpowiedzi" przy zakończeniu). */
export const withResultOnly = <R>(session: SentenceSession<R>, id: string, result: R) =>
  update(session, id, (slot) => ({ ...slot, result }));

/** Błąd sprawdzania: zdejmuje tylko status „w toku", odpowiedź i ewentualny wynik zostają. */
export const withoutEvaluating = <R>(session: SentenceSession<R>, id: string) => {
  const slot = session[id];
  if (!slot || slot.status !== 'evaluating') return session;
  const { status: _status, ...rest } = slot;
  return { ...session, [id]: rest };
};

/** Kasuje ocenę jednego zdania (status i wynik), odpowiedź zostaje. */
export const withoutEvaluation = <R>(session: SentenceSession<R>, id: string) => {
  const slot = session[id];
  if (!slot) return session;
  const { status: _status, result: _result, ...rest } = slot;
  return { ...session, [id]: rest };
};

// --- Widoki po indeksie (dla kodu, który czyta „zdanie nr i") -----------------------------------

export const answersView = <R>(exercises: ReadonlyArray<MaybeStamped>, session: SentenceSession<R>): string[] =>
  exercises.map((exercise) => slotOf(session, exerciseId(exercise)).answer);

export const hintsView = <R>(exercises: ReadonlyArray<MaybeStamped>, session: SentenceSession<R>): boolean[] =>
  exercises.map((exercise) => slotOf(session, exerciseId(exercise)).hintOpen);

export const statusesView = <R>(exercises: ReadonlyArray<MaybeStamped>, session: SentenceSession<R>): Record<number, EvaluationStatus> => {
  const out: Record<number, EvaluationStatus> = {};
  exercises.forEach((exercise, index) => {
    const { status } = slotOf(session, exerciseId(exercise));
    if (status) out[index] = status;
  });
  return out;
};

export const resultsView = <R>(exercises: ReadonlyArray<MaybeStamped>, session: SentenceSession<R>): Record<number, R> => {
  const out: Record<number, R> = {};
  exercises.forEach((exercise, index) => {
    const { result } = slotOf(session, exerciseId(exercise));
    if (result !== undefined) out[index] = result;
  });
  return out;
};
