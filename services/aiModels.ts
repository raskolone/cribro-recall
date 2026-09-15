/**
 * Kaskada modeli AI — jedno źródło prawdy dla klienta i dla serwera.
 *
 * Wcześniej kolejność modeli była wpisana w sześciu miejscach (klient,
 * `server.ts` w dwóch trasach, wariant serverless, generator prac domowych,
 * kilka wywołań punktowych) i każde z nich schodziło niżej inaczej. Zmiana
 * modelu znaczyła polowanie po repo, a rozjazd między listami był niewidoczny
 * aż do momentu, w którym jeden endpoint wołał model, którego drugi już nie
 * znał.
 *
 * Plik celowo nie importuje niczego: wchodzi zarówno do bundla przeglądarki,
 * jak i do `server.ts` uruchamianego przez tsx.
 *
 * Porządek schodzenia jest stały i wynika z ról, nie z upodobań:
 *   1. PRIMARY   — najmocniejszy, układa zadania i ocenia odpowiedzi,
 *   2. SECONDARY — inny dostawca, żeby awaria jednego nie zatrzymała nauki,
 *   3. TERTIARY  — lekki i tani; ma dowieźć cokolwiek sensownego, gdy dwa
 *                  poprzednie odmówią. Nigdy nie jest pierwszym wyborem.
 */

/** Model pierwszego wyboru — układanie zadań, ocena, streszczenia lekcji. Zgodnie z wytycznymi: Gemini 2.5 Flash */
export const PRIMARY_MODEL = 'gemini-2.5-flash';

/** Zapas u drugiego dostawcy / nowsza wersja Gemini. */
export const SECONDARY_MODEL = 'gemini-3.8-flash';

/** Trzeci rzut: lekki, szybki model OpenAI. */
export const TERTIARY_MODEL = 'openai/gpt-4o-mini';

/** Opcjonalny model zaawansowany. */
export const QUATERNARY_MODEL = 'openai/gpt-5.6-luna';

/**
 * Domyślna kaskada dla zadań tekstowych i JSON-owych.
 * Zgodnie z wytycznymi: na początku zawsze gemini-2.5-flash.
 */
export const AI_MODEL_CASCADE: string[] = [
  PRIMARY_MODEL,
  SECONDARY_MODEL,
  TERTIARY_MODEL,
  QUATERNARY_MODEL,
];

/**
 * Kaskada po stronie OpenAI — bez prefiksu `openai/`, bo tak nazwy trafiają
 * wprost do API. Serwer przechodzi tę listę, zanim odda sprawę Gemini.
 */
export const OPENAI_MODEL_CASCADE: string[] = AI_MODEL_CASCADE.filter((m) =>
  m.startsWith('openai/')
).map((m) => m.replace('openai/', ''));

/** Kaskada Gemini — kolejność prób po wyczerpaniu modeli OpenAI. */
export const GEMINI_MODEL_CASCADE: string[] = AI_MODEL_CASCADE.filter((m) =>
  m.startsWith('gemini')
);

/**
 * Układa listę modeli OpenAI do wypróbowania, zaczynając od modelu, o który
 * poprosił klient.
 *
 * Bez tego serwer ignorował pole `model` z żądania i zawsze zaczynał od
 * swojego pierwszego modelu — wybór modelu po stronie aplikacji był wtedy
 * czystą dekoracją.
 */
export const openAiModelsFor = (requestedModel?: string | null): string[] => {
  const requested = requestedModel ? String(requestedModel).replace('openai/', '').trim() : '';
  return Array.from(new Set([requested, ...OPENAI_MODEL_CASCADE].filter(Boolean)));
};

/* ═══════════════════════════════════════════════════════════════════════
   MODELE PER ZADANIE — WYBÓR ADMINISTRATORA

   ══ PO CO ══

   Jedna kaskada dla całej aplikacji znaczyła, że ten sam model układa zadania,
   ocenia odpowiedzi i odpowiada w czacie. To są trzy różne wymagania: ocena
   musi być dokładna i wolno jej kosztować, czat ma być szybki, a generowanie
   zdań leży pośrodku. Do tej pory zmiana któregokolwiek z nich wymagała
   wejścia w kod i wdrożenia.

   ══ JAK TO DZIAŁA ══

   Każde zadanie ma WŁASNĄ kaskadę: model pierwszego wyboru i zapasy. Ustawienia
   administratora nadpisują pierwszy model; reszta kaskady zostaje, bo to ona
   ratuje sytuację przy awarii dostawcy i nie jest kwestią gustu.

   Zadania nazywamy po tym, CO robią, a nie po tym, który ekran je woła —
   ekranów przybywa, a rodzajów pracy nie.
   ═══════════════════════════════════════════════════════════════════════ */

export type AiTaskId = 'exercises' | 'grading' | 'chat' | 'summaries';

export interface AiTaskDefinition {
  id: AiTaskId;
  label: string;
  description: string;
  /** Domyślna kolejność prób dla tego zadania. */
  cascade: string[];
}

export const AI_TASKS: AiTaskDefinition[] = [
  {
    id: 'exercises',
    label: 'Generowanie zadań i zdań',
    description:
      'Zdania do tłumaczenia, luki, poprawianie błędów, testy, fiszki z tematu.',
    cascade: AI_MODEL_CASCADE,
  },
  {
    id: 'grading',
    label: 'Ocena odpowiedzi kursanta',
    description:
      'Sprawdzanie prac domowych i testów, komentarze do pojedynczych zdań.',
    cascade: AI_MODEL_CASCADE,
  },
  {
    id: 'chat',
    label: 'Czat i asystent',
    description: 'Asystent lektora, rozmowa przy pracy domowej, podpowiedzi w locie.',
    // Czat zaczyna od podstawowego modelu Gemini 2.5 Flash
    cascade: [PRIMARY_MODEL, SECONDARY_MODEL, TERTIARY_MODEL],
  },
  {
    id: 'summaries',
    label: 'Streszczenia i odprawy',
    description: 'Podsumowania lekcji, odprawa przed lekcją, notatki pedagogiczne.',
    cascade: AI_MODEL_CASCADE,
  },
];

/**
 * Kategorie zapytań (`aiMonitor`) → zadanie.
 *
 * Kategoria jest podawana przy każdym wywołaniu modelu od dawna, więc mapa
 * wpina wybór administratora we WSZYSTKIE istniejące miejsca naraz, bez
 * dotykania pięćdziesięciu wywołań.
 */
export const AI_CATEGORY_TO_TASK: Record<string, AiTaskId> = {
  'sentence-gen': 'exercises',
  test: 'exercises',
  flashcards: 'exercises',
  autocomplete: 'exercises',
  evaluation: 'grading',
  stats: 'summaries',
  general: 'chat',
};

/** Wszystkie modele, które wolno wybrać w ustawieniach. */
export const SELECTABLE_MODELS: { id: string; label: string; provider: 'openai' | 'gemini' }[] = [
  { id: 'openai/gpt-5.6-luna', label: 'GPT 5.6 Luna', provider: 'openai' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'gemini' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
];

/** Nadpisania z ustawień: zadanie → model pierwszego wyboru. */
export type AiTaskOverrides = Partial<Record<AiTaskId, string>>;

/**
 * Kolejność prób dla zadania, z uwzględnieniem wyboru administratora.
 *
 * Wybrany model wchodzi na początek, a z dalszej części kaskady znika jego
 * duplikat — bez tego przy wyborze modelu, który już był w kaskadzie, byłby
 * odpytywany dwa razy pod rząd.
 */
export const cascadeForTask = (task: AiTaskId, overrides?: AiTaskOverrides): string[] => {
  const definition = AI_TASKS.find(item => item.id === task) || AI_TASKS[0];
  const chosen = overrides?.[task];
  if (!chosen) return definition.cascade;
  return Array.from(new Set([chosen, ...definition.cascade]));
};

/** Kolejność prób dla kategorii zapytania (`aiMonitor`). */
export const cascadeForCategory = (
  category: string | undefined,
  overrides?: AiTaskOverrides
): string[] => cascadeForTask(AI_CATEGORY_TO_TASK[category || 'general'] || 'chat', overrides);
