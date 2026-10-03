/**
 * Warstwa historii przeglądarki nad stanem panelu (Dashboard + AdminPanel).
 *
 * „Gdzie jestem" w panelu definiuje kilka zmiennych naraz (widok, zakładka,
 * wybrany kursant, wybrana grupa, ...) i żadna z nich nie jest adresem URL.
 * Zamiast przebudowywać przechowywanie stanu, każde „miejsce" odkładamy jako
 * wpis `history.state`, a `popstate` wpisuje je z powrotem do tych samych
 * zmiennych. Adres URL się nie zmienia.
 *
 * Ten plik to sama logika bez DOM-u (okno przekazywane jako argument), żeby
 * dało się ją przetestować: kiedy dopisać wpis, kiedy tylko podmienić, jak
 * odczytać wpis i czy da się cofnąć w obrębie aplikacji.
 */

export interface PanelPlace {
  view: string;
  activeSetId: string | null;
  adminSelectedUserId: string | null;
  adminActiveTab: string | null;
  adminSelectedGroupId: string | null;
  activeTaskId: string | null;
  activeTestId: string | null;
  homeworkFilterStatus: string | null;
}

/** Znacznik odróżniający nasze wpisy od cudzych (np. stanu innych bibliotek). */
export const PANEL_HISTORY_MARKER = 'cribroPanel';

/**
 * Po `popstate` stan z wpisu trafia do zmiennych, które potrafią się jeszcze
 * chwilę dostroić (AdminPanel wyrównuje zakładkę i kursanta w swoich
 * efektach). Zmiana w tym oknie podmienia bieżący wpis zamiast dopisywać
 * nowy — dopisanie ucięłoby wpisy „do przodu".
 */
export const SETTLE_AFTER_POP_MS = 500;

export interface PanelHistoryState {
  [PANEL_HISTORY_MARKER]: 1;
  /** Numer wpisu w obrębie aplikacji; 0 = pierwszy po wejściu na stronę. */
  idx: number;
  place: PanelPlace;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/**
 * Składa miejsce z dowolnego obiektu (stan z historii, zapis w sessionStorage).
 * Zwraca `null`, gdy nie ma nawet widoku — wtedy to nie jest miejsce panelu.
 */
export function toPlace(raw: unknown): PanelPlace | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const view = str(r.view);
  if (!view) return null;
  return {
    view,
    activeSetId: str(r.activeSetId),
    adminSelectedUserId: str(r.adminSelectedUserId),
    adminActiveTab: str(r.adminActiveTab),
    adminSelectedGroupId: str(r.adminSelectedGroupId),
    activeTaskId: str(r.activeTaskId),
    activeTestId: str(r.activeTestId),
    homeworkFilterStatus: str(r.homeworkFilterStatus),
  };
}

export function samePlace(a: PanelPlace, b: PanelPlace): boolean {
  return (
    a.view === b.view &&
    a.activeSetId === b.activeSetId &&
    a.adminSelectedUserId === b.adminSelectedUserId &&
    a.adminActiveTab === b.adminActiveTab &&
    a.adminSelectedGroupId === b.adminSelectedGroupId &&
    a.activeTaskId === b.activeTaskId &&
    a.activeTestId === b.activeTestId &&
    a.homeworkFilterStatus === b.homeworkFilterStatus
  );
}

export function toHistoryState(place: PanelPlace, idx: number): PanelHistoryState {
  return { [PANEL_HISTORY_MARKER]: 1, idx, place: { ...place } };
}

/**
 * Odczyt `history.state`. Wpisy sprzed tej warstwy (`{ view, activeSetId }`
 * z dawnego `pushState` w Dashboardzie) też dają miejsce — bez numeru wpisu,
 * więc `idx` jest wtedy `null`.
 */
export function readHistoryState(state: unknown): { place: PanelPlace; idx: number | null } | null {
  if (!state || typeof state !== 'object') return null;
  const s = state as Record<string, unknown>;
  if (s[PANEL_HISTORY_MARKER] === 1) {
    const place = toPlace(s.place);
    if (!place) return null;
    const idx = typeof s.idx === 'number' && Number.isInteger(s.idx) && s.idx >= 0 ? s.idx : 0;
    return { place, idx };
  }
  const legacy = toPlace(s);
  return legacy ? { place: legacy, idx: null } : null;
}

export type HistoryAction = 'none' | 'push' | 'replace';

/**
 * Co zrobić z historią, gdy bieżące miejsce różni się (albo nie) od ostatnio
 * zapisanego.
 *
 * - to samo miejsce → nic (żadnych duplikatów),
 * - tuż po `popstate` → podmiana (patrz `SETTLE_AFTER_POP_MS`),
 * - karta grupy dowiaduje się o `groupId` po wejściu w zakładkę, więc
 *   samo dopisanie identyfikatora do tego samego miejsca to dopracowanie
 *   wpisu, nie nowe miejsce → podmiana,
 * - w pozostałych przypadkach → nowy wpis.
 */
export function decideHistoryAction(
  current: PanelPlace,
  committed: PanelPlace,
  settling: boolean
): HistoryAction {
  if (samePlace(current, committed)) return 'none';
  if (settling) return 'replace';
  if (
    committed.adminSelectedGroupId === null &&
    current.adminSelectedGroupId !== null &&
    samePlace({ ...current, adminSelectedGroupId: null }, committed)
  ) {
    return 'replace';
  }
  return 'push';
}

type HistoryLike = Pick<History, 'state' | 'back'>;

/**
 * Przycisk „Wróć" w aplikacji. Jest poprzedni wpis aplikacji → to samo, co
 * „wstecz" przeglądarki; nie ma (świeże wejście na stronę) → `fallback`,
 * czyli dotychczasowe zachowanie przycisku.
 *
 * Zwraca `true`, gdy cofnęła historia.
 */
export function goBackOr(fallback: () => void, hist: HistoryLike | undefined = typeof window !== 'undefined' ? window.history : undefined): boolean {
  const entry = hist ? readHistoryState(hist.state) : null;
  if (hist && entry && entry.idx !== null && entry.idx > 0) {
    hist.back();
    return true;
  }
  fallback();
  return false;
}
