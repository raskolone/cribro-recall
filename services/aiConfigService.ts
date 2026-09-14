import { auth } from '../firebase';
import { AiTaskOverrides } from './aiModels';

/**
 * Konfiguracja AI ustawiana przez administratora w aplikacji.
 *
 * ══ DLACZEGO PRZEZ SERWER, A NIE PROSTO Z FIRESTORE ══
 *
 * W tym samym dokumencie leżą klucze API. Gdyby aplikacja czytała go wprost,
 * trzeba by otworzyć regułę odczytu na kolekcji `system` — a wtedy klucz
 * OpenAI wystarczy pobrać z przeglądarki dowolnego zalogowanego kursanta.
 * Serwer oddaje więc WYBÓR MODELI wszystkim zalogowanym (bo aplikacja musi
 * wiedzieć, czym liczyć), a klucze wyłącznie w postaci zamaskowanej i tylko
 * administratorowi.
 *
 * ══ BUFOR ══
 *
 * Konfiguracja zmienia się raz na kilka tygodni, a czytana jest przy każdym
 * wywołaniu modelu. Trzymamy ją więc w pamięci modułu i odświeżamy raz na
 * sesję albo po zapisie w ustawieniach. Gdy odczyt się nie uda, zostają
 * kaskady domyślne — aplikacja nigdy nie staje przez brak konfiguracji.
 */

export interface AiKeyStatus {
  configured: boolean;
  maskedKey?: string;
  /** Skąd klucz pochodzi — zmienna środowiskowa czy zapis w aplikacji. */
  source?: 'env' | 'app';
}

export interface AiConfig {
  models: AiTaskOverrides;
  keys?: {
    openai?: AiKeyStatus;
    gemini?: AiKeyStatus;
    elevenlabs?: AiKeyStatus;
  };
}

let cached: AiConfig | null = null;
let inFlight: Promise<AiConfig> | null = null;

const authHeader = async (): Promise<Record<string, string>> => {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Wybór modeli — z bufora albo z serwera. Nigdy nie rzuca. */
export const getAiConfig = async (): Promise<AiConfig> => {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch('/api/ai/config', { headers: await authHeader() });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as AiConfig;
      cached = { models: data.models || {}, keys: data.keys };
      return cached;
    } catch {
      // Brak konfiguracji to nie awaria — działamy na kaskadach domyślnych.
      cached = { models: {} };
      return cached;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

/** Ostatnio pobrana konfiguracja BEZ czekania — do wyboru modelu w locie. */
export const peekAiOverrides = (): AiTaskOverrides => cached?.models || {};

/** Wymusza ponowny odczyt (po zapisie w ustawieniach). */
export const invalidateAiConfig = (): void => {
  cached = null;
};

export const saveAiModels = async (models: AiTaskOverrides): Promise<void> => {
  const res = await fetch('/api/ai/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ models }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Nie udało się zapisać wyboru modeli.');
  invalidateAiConfig();
};

export const saveAiKey = async (
  provider: 'openai' | 'gemini' | 'elevenlabs',
  apiKey: string
): Promise<AiKeyStatus> => {
  const res = await fetch('/api/ai/save-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ provider, apiKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Nie udało się zapisać klucza.');
  invalidateAiConfig();
  return { configured: true, maskedKey: data.maskedKey, source: 'app' };
};
