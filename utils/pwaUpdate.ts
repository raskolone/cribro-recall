/**
 * Aktualizacje PWA — logika bez zależności od przeglądarki (wszystko wstrzykiwane).
 *
 * ══ PO CO ══
 *
 * Service worker aplikacji (sw.ts) ma `skipWaiting()` + `clientsClaim()`, więc nowa wersja
 * przejmuje kontrolę od razu — ale OTWARTA strona dalej działa na starym JS-ie, a przeglądarka
 * sprawdza `sw.js` tylko przy nawigacji. Na iPhonie PWA z ikony zwykle jest WZNAWIANA, nie
 * uruchamiana od nowa, więc stary interfejs mógł wisieć dniami (zmierzone: wznowienie = 0 żądań
 * o `sw.js`, pierwsze uruchomienie po wdrożeniu nadal pokazuje starą wersję).
 *
 * Ten moduł: (1) rejestruje SW, (2) sprawdza aktualizację przy powrocie do aplikacji, po
 * odzyskaniu sieci i co ~30 min, (3) po przejęciu kontroli przez nową wersję zapala flagę
 * „update gotowy" (UI pokazuje baner), (4) przeładowanie wykonuje wyłącznie na prośbę
 * użytkownika, z blokadą pętli.
 *
 * Nie przeładowujemy sami: kursant może być w środku ćwiczenia, a lektor w notatniku.
 */

export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** Minimalny odstęp między sprawdzeniami wywołanymi powrotem do aplikacji / siecią. */
export const MIN_CHECK_GAP_MS = 60 * 1000;
export const RELOAD_GUARD_KEY = 'pwa_update_reloaded_at';
/** Drugie przeładowanie „dla aktualizacji" w tym oknie jest blokowane (pętla). */
export const RELOAD_GUARD_WINDOW_MS = 30 * 1000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface RegistrationLike {
  update(): Promise<unknown>;
}
export interface ServiceWorkerContainerLike {
  readonly controller: unknown | null;
  register(url: string, options?: { scope?: string }): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
  removeEventListener(type: 'controllerchange', listener: () => void): void;
}
interface EventTargetLike<T extends string> {
  addEventListener(type: T, listener: () => void): void;
  removeEventListener(type: T, listener: () => void): void;
}
export interface PwaUpdaterDeps {
  container: ServiceWorkerContainerLike;
  doc: EventTargetLike<'visibilitychange'> & { readonly visibilityState: string };
  win: EventTargetLike<'online'>;
  /** sessionStorage — blokada pętli przeładowań. Brak = blokada nie działa, ale nic się nie psuje. */
  storage?: StorageLike;
  now?: () => number;
  reload: () => void;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  scriptUrl?: string;
}

export interface PwaUpdateState {
  /** Nowa wersja przejęła kontrolę, ta strona działa jeszcze na starej. */
  updateReady: boolean;
  /** Użytkownik zamknął baner (wraca przy następnej nowej wersji). */
  dismissed: boolean;
}

/** Czy wolno przeładować stronę „dla aktualizacji" (nie było takiego przeładowania przed chwilą). */
export function canReloadForUpdate(storage: StorageLike | undefined, now: number): boolean {
  if (!storage) return true;
  try {
    const last = Number(storage.getItem(RELOAD_GUARD_KEY));
    return !(Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_WINDOW_MS);
  } catch {
    return true;
  }
}

export function createPwaUpdater(deps: PwaUpdaterDeps) {
  const now = deps.now ?? (() => Date.now());
  const setIntervalFn = deps.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = deps.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));

  let registration: RegistrationLike | null = null;
  let started = false;
  // Pierwsza instalacja też kończy się `controllerchange` (clientsClaim) — to NIE jest aktualizacja.
  let hadController = Boolean(deps.container.controller);
  let lastCheckAt = 0;
  let timer: unknown = null;
  let state: PwaUpdateState = { updateReady: false, dismissed: false };
  const listeners = new Set<() => void>();

  const setState = (next: PwaUpdateState) => {
    state = next;
    listeners.forEach((l) => l());
  };

  const check = (force = false) => {
    if (!registration) return;
    const t = now();
    if (!force && t - lastCheckAt < MIN_CHECK_GAP_MS) return;
    lastCheckAt = t;
    // Offline / błąd sieci to normalna sytuacja telefonu — nic z tym nie robimy.
    registration.update().catch(() => {});
  };

  const onControllerChange = () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    setState({ updateReady: true, dismissed: false });
  };
  const onVisibility = () => {
    if (deps.doc.visibilityState === 'visible') check();
  };
  const onOnline = () => check();

  return {
    async start(): Promise<void> {
      if (started) return;
      started = true;
      deps.container.addEventListener('controllerchange', onControllerChange);
      deps.doc.addEventListener('visibilitychange', onVisibility);
      deps.win.addEventListener('online', onOnline);
      timer = setIntervalFn(() => {
        if (deps.doc.visibilityState === 'visible') check(true);
      }, UPDATE_CHECK_INTERVAL_MS);
      try {
        registration = await deps.container.register(deps.scriptUrl ?? '/sw.js', { scope: '/' });
        lastCheckAt = now();
      } catch (error) {
        console.warn('[pwa] rejestracja service workera nie powiodła się', error);
      }
    },
    stop(): void {
      if (!started) return;
      started = false;
      deps.container.removeEventListener('controllerchange', onControllerChange);
      deps.doc.removeEventListener('visibilitychange', onVisibility);
      deps.win.removeEventListener('online', onOnline);
      if (timer !== null) clearIntervalFn(timer);
      timer = null;
    },
    getState: (): PwaUpdateState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dismiss(): void {
      if (state.updateReady && !state.dismissed) setState({ ...state, dismissed: true });
    },
    /**
     * Przeładowuje stronę na nową wersję. Zwraca `false` (i tylko chowa baner), gdy takie
     * przeładowanie było przed chwilą — to jedyna bariera przed pętlą, gdyby nowy SW
     * znowu zgłaszał zmianę zaraz po przeładowaniu.
     */
    applyUpdate(): boolean {
      const t = now();
      if (!canReloadForUpdate(deps.storage, t)) {
        setState({ ...state, dismissed: true });
        return false;
      }
      try {
        deps.storage?.setItem(RELOAD_GUARD_KEY, String(t));
      } catch {
        /* storage niedostępny — przeładowujemy mimo to */
      }
      deps.reload();
      return true;
    },
  };
}

export type PwaUpdater = ReturnType<typeof createPwaUpdater>;
