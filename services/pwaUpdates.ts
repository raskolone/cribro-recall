import { createPwaUpdater, PwaUpdater } from '../utils/pwaUpdate';

let updater: PwaUpdater | null = null;

/** Jedna instancja na kartę. `null` tam, gdzie nie ma service workerów (dev, stare przeglądarki). */
export function getPwaUpdater(): PwaUpdater | null {
  if (updater) return updater;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = undefined;
  }
  updater = createPwaUpdater({
    container: navigator.serviceWorker,
    doc: document,
    win: window,
    storage,
    reload: () => window.location.reload(),
  });
  return updater;
}

/** Rejestruje SW po załadowaniu strony (jak dotychczasowy registerSW.js) i włącza sprawdzanie aktualizacji. */
export function startPwaUpdates(): void {
  const u = getPwaUpdater();
  if (!u) return;
  const go = () => {
    void u.start();
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
