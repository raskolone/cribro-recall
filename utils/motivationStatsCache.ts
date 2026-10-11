/**
 * Pamięć sesji dla liczników motywacyjnych: panel kursanta liczy je z nasłuchów, które i tak ma, a ekrany
 * ćwiczeń korzystają z tego wyniku bez dodatkowych odczytów. Opcjonalnie lustro w localStorage (try/catch) —
 * ekran musi działać bez storage. Nic nie trafia do bazy.
 */
import type { MotivationCounts } from './motivationStats';

const memory = new Map<string, MotivationCounts>();
let visitCounter = 0;

const storageKey = (uid: string) => `motivation_counts_v1_${uid}`;
const VISIT_KEY = 'motivation_visit_v1';

const isCounts = (value: unknown): value is MotivationCounts =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function getMotivationCounts(uid: string | undefined | null): MotivationCounts | null {
  if (!uid) return null;
  const hit = memory.get(uid);
  if (hit) return hit;
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isCounts(parsed)) {
        memory.set(uid, parsed);
        return parsed;
      }
    }
  } catch {
    /* brak storage — pamięć sesji wystarcza */
  }
  return null;
}

export function setMotivationCounts(uid: string | undefined | null, counts: MotivationCounts): void {
  if (!uid) return;
  memory.set(uid, counts);
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(counts));
  } catch {
    /* storage niedostępny lub pełny */
  }
}

/** Numer wejścia w panel (rośnie przy każdym wywołaniu) — dla `prefers-reduced-motion` (kolejna statystyka przy każdym wejściu). */
export function nextVisit(): number {
  visitCounter += 1;
  try {
    const stored = Number(localStorage.getItem(VISIT_KEY));
    visitCounter = Math.max(visitCounter, Number.isFinite(stored) ? stored + 1 : 0);
    localStorage.setItem(VISIT_KEY, String(visitCounter));
  } catch {
    /* tylko pamięć */
  }
  return visitCounter;
}

/** Tylko do testów. */
export function resetMotivationCache(): void {
  memory.clear();
  visitCounter = 0;
}
