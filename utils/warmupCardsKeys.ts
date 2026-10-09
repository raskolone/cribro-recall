/**
 * Klawiatura i kolejka przejść fiszek rozgrzewki (`HomeworkWarmupCards`).
 *
 * Czysta logika bez Reacta, DOM-u i GSAP, żeby dało się ją sprawdzić w
 * node:test. Komponent tłumaczy zdarzenie klawisza na zamiar (`intent`),
 * kolejka decyduje, czy zamiar wykonać od razu, czy poczekać na koniec
 * animacji, a `intentToAction` dopiero w chwili wykonania sprawdza granice
 * talii — zakolejkowane „Dalej" z przedostatniej karty nie może więc po
 * dojściu do ostatniej zamienić się w zakończenie kart.
 */

/** Zamiar użytkownika, zanim zestawimy go z bieżącą kartą. */
export type WarmupCardsIntent = 'next' | 'prev' | 'flip' | 'enter';

/** To, co faktycznie trzeba zrobić na bieżącej karcie. */
export type WarmupCardsAction = 'next' | 'prev' | 'flip' | 'finish';

/** Minimalny kształt celu zdarzenia — wystarcza element DOM albo zwykły obiekt w teście. */
export interface KeyTargetLike {
  tagName?: string;
  type?: string;
  href?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  parentElement?: KeyTargetLike | null;
}

export interface WarmupCardsKeyEventLike {
  key: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
}

export interface WarmupCardsKeyResult {
  intent: WarmupCardsIntent | null;
  /** Klawisz należy do kart — wywołujący ma zrobić preventDefault (spacja nie przewija, przycisk nie klika się drugi raz). */
  preventDefault: boolean;
}

/** Inputy, w których nie pisze się tekstu — klawisze z nich nie są pisaniem. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'radio',
  'range',
  'submit',
  'reset',
  'file',
  'color',
  'image',
]);

const asTarget = (target: unknown): KeyTargetLike | null =>
  target && typeof target === 'object' ? (target as KeyTargetLike) : null;

const tagOf = (el: KeyTargetLike): string => String(el.tagName ?? '').toUpperCase();

/**
 * Czy fokus jest w polu tekstowym (input tekstowy, textarea, select,
 * contenteditable — także w potomku edytowalnego przodka). Tam strzałki i
 * spacja należą do pisania, więc karty ich nie przechwytują.
 */
export function isTextEntryTarget(target: unknown): boolean {
  let el = asTarget(target);
  const first = el;
  if (!first) return false;
  const tag = tagOf(first);
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUT_TYPES.has(String(first.type || 'text').toLowerCase());
  if (first.isContentEditable) return true;
  // jsdom nie liczy isContentEditable — sprawdzamy atrybut w górę drzewa.
  while (el) {
    const attr = el.getAttribute?.('contenteditable');
    if (attr !== null && attr !== undefined && attr !== 'false') return true;
    el = el.parentElement ?? null;
  }
  return false;
}

/**
 * Czy cel sam obsługuje Enter (przycisk, link, przycisk-input). Wtedy Enter
 * zostawiamy przeglądarce — np. sfokusowane „Zakończ karty" kończy samo, bez
 * drugiego wywołania z obsługi klawiatury kart.
 */
export function isNativeActivationTarget(target: unknown): boolean {
  const el = asTarget(target);
  if (!el) return false;
  const tag = tagOf(el);
  if (tag === 'BUTTON' || tag === 'SUMMARY') return true;
  if (tag === 'A') return Boolean(el.href || el.getAttribute?.('href'));
  if (tag === 'INPUT') return NON_TEXT_INPUT_TYPES.has(String(el.type || '').toLowerCase());
  return false;
}

const IGNORED: WarmupCardsKeyResult = { intent: null, preventDefault: false };

/**
 * Klawisz → zamiar. Strzałka w prawo/lewo = następna/poprzednia, spacja =
 * odwróć (bez powtórzeń z trzymanego klawisza, ale zawsze z preventDefault),
 * Enter = zakończ (granice sprawdza `intentToAction`). Pola tekstowe,
 * kombinacje z Ctrl/Alt/Cmd, kompozycja IME i zdarzenia już obsłużone są
 * ignorowane w całości.
 */
export function resolveWarmupCardsKey(e: WarmupCardsKeyEventLike): WarmupCardsKeyResult {
  if (e.defaultPrevented || e.isComposing) return IGNORED;
  if (e.altKey || e.ctrlKey || e.metaKey) return IGNORED;
  if (isTextEntryTarget(e.target)) return IGNORED;

  switch (e.key) {
    case 'ArrowRight':
      return { intent: 'next', preventDefault: true };
    case 'ArrowLeft':
      return { intent: 'prev', preventDefault: true };
    case ' ':
    case 'Spacebar':
      return { intent: e.repeat ? null : 'flip', preventDefault: true };
    case 'Enter':
      if (e.repeat || isNativeActivationTarget(e.target)) return IGNORED;
      return { intent: 'enter', preventDefault: true };
    default:
      return IGNORED;
  }
}

/**
 * Spacja aktywuje przycisk dopiero na keyup (Firefox nie respektuje samego
 * preventDefault na keydown), więc odpowiadający keyup też trzeba zdusić —
 * inaczej sfokusowany przycisk kliknąłby się obok odwrócenia karty.
 */
export function shouldSuppressKeyUp(e: WarmupCardsKeyEventLike): boolean {
  if (e.key !== ' ' && e.key !== 'Spacebar') return false;
  if (e.altKey || e.ctrlKey || e.metaKey) return false;
  return !isTextEntryTarget(e.target);
}

/**
 * Zamiar → akcja na karcie `index` z `total`. Granice: na pierwszej karcie
 * „wstecz" nic nie robi, na ostatniej strzałka w prawo nic nie robi (kończy
 * tylko Enter albo przycisk „Zakończ karty"), Enter poza ostatnią kartą też nic.
 */
export function intentToAction(intent: WarmupCardsIntent, index: number, total: number): WarmupCardsAction | null {
  if (total <= 0 || index < 0 || index >= total) return null;
  const isLast = index === total - 1;
  switch (intent) {
    case 'next':
      return isLast ? null : 'next';
    case 'prev':
      return index === 0 ? null : 'prev';
    case 'flip':
      return 'flip';
    case 'enter':
      return isLast ? 'finish' : null;
    default:
      return null;
  }
}

export interface WarmupCardsQueue {
  /**
   * Prośba o zamiar. Wolna kolejka → zwraca zamiar do wykonania od razu.
   * Trwa przejście → zapamiętuje OSTATNI zamiar i zwraca null; powtórzenia
   * z trzymanego klawisza są wtedy odrzucane, żeby po puszczeniu strzałki
   * karta nie przeskoczyła jeszcze raz.
   */
  request(intent: WarmupCardsIntent, repeat?: boolean): WarmupCardsIntent | null;
  /** Początek przejścia między kartami — kolejne zamiary czekają. */
  lock(): void;
  /** Koniec przejścia — zwalnia blokadę i oddaje zakolejkowany zamiar (albo null). */
  release(): WarmupCardsIntent | null;
  readonly busy: boolean;
}

export function createWarmupCardsQueue(): WarmupCardsQueue {
  let busy = false;
  let queued: WarmupCardsIntent | null = null;
  return {
    request(intent, repeat = false) {
      if (!busy) return intent;
      if (!repeat) queued = intent;
      return null;
    },
    lock() {
      busy = true;
    },
    release() {
      const next = queued;
      busy = false;
      queued = null;
      return next;
    },
    get busy() {
      return busy;
    },
  };
}

/** Szerokość paska postępu w procentach dla karty `index` (od 0) z `total`. */
export function warmupCardsProgressPercent(index: number, total: number): number {
  if (total <= 0) return 0;
  const current = Math.min(Math.max(index, 0), total - 1) + 1;
  return Math.round((current / total) * 1000) / 10;
}
