/**
 * Wywołanie modelu dla silnika v2.
 *
 * Kaskada jest **wyłącznie po stronie OpenAI**. To nie jest przeoczenie, tylko
 * wymóg zlecenia: kaskada v1 (`services/aiModels.ts`) schodzi do Gemini na
 * pozycjach 2 i 4, a walidator naturalności, który raz odpowiada z OpenAI, a raz
 * z Gemini, nie jest walidatorem — jest losowaniem.
 *
 * Wywołanie idzie surowym `fetch`, dokładnie jak w `server.ts`. Pakiet `openai`
 * jest w `package.json` katalogu głównego, ale nie jest importowany w żadnym
 * pliku i nie ma go w zależnościach funkcji. Kopiowanie tu tego samego `fetch`
 * kosztuje kilkanaście linii i zero nowych zależności.
 */

// ---------------------------------------------------------------------------
// Modele
// ---------------------------------------------------------------------------

/**
 * Nazwa logiczna modelu wiodącego.
 *
 * `gpt-5.6-luna` nie jest identyfikatorem endpointu OpenAI — to nazwa poziomu
 * („flagowy") używana w tym repo. Przekład na realny model robi
 * `mapToActualOpenAIModel`, tak samo jak `server.ts:2`.
 */
export const V2_PRIMARY_MODEL = 'gpt-5.6-luna';

/** Zapas. Ten akurat jest prawdziwą nazwą endpointu. */
export const V2_FALLBACK_MODEL = 'gpt-4o-mini';

/**
 * Kaskada v2. Dwie pozycje, oba OpenAI.
 *
 * Nie dopisuj tu niczego bez zmiany zlecenia — w szczególności żadnego modelu
 * Gemini, DeepSeek ani Opusa.
 */
export const V2_MODEL_CASCADE: readonly string[] = [V2_PRIMARY_MODEL, V2_FALLBACK_MODEL] as const;

/**
 * Przekład nazwy logicznej na realny endpoint OpenAI.
 *
 * Zachowanie musi odpowiadać `mapToActualOpenAIModel` z `server.ts` — inaczej
 * v1 i v2 pytałyby dwa różne modele, myśląc, że pytają ten sam. Kod jest
 * powtórzony, bo `server.ts` należy do innego pakietu, ma inny target i nie
 * wchodzi do bundla funkcji; import przez granicę pakietu wciągnąłby do
 * wdrożenia cały serwer Express.
 */
export const mapToActualOpenAIModel = (modelName: string): string => {
  const clean = String(modelName || '')
    .replace(/^openai\//, '')
    .trim()
    .toLowerCase();
  if (clean === 'gpt-5.6-luna' || clean === 'gpt-5.6' || clean.includes('luna')) return 'gpt-4o';
  if (clean.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (clean.includes('gpt-4o')) return 'gpt-4o';
  return 'gpt-4o-mini';
};

// ---------------------------------------------------------------------------
// Kontrakt wywołania
// ---------------------------------------------------------------------------

export interface ModelRequest {
  /** Instrukcja systemowa — rola i zasady. */
  system: string;
  /** Treść zapytania. */
  user: string;
  /** Etykieta do logu kosztu. Nigdy nie zawiera treści odpowiedzi kursanta. */
  taskName: string;
  /** Niższa dla walidatora i oceny, wyższa dla układania zadań. */
  temperature?: number;
}

export interface ModelResponse {
  /** Sparsowany JSON. Silnik nie pracuje na surowym tekście. */
  data: unknown;
  /** Nazwa logiczna modelu, który odpowiedział. */
  modelUsed: string;
  latencyMs: number;
}

/**
 * Zależność wstrzykiwana do serwisów.
 *
 * Dzięki niej `ExerciseGenerator` i `QualityValidator` dają się przetestować
 * bez klucza, bez sieci i bez kosztu — test podstawia własną funkcję zamiast
 * `createOpenAiCall`.
 */
export type ModelCall = (request: ModelRequest) => Promise<ModelResponse>;

// ---------------------------------------------------------------------------
// Parsowanie odpowiedzi
// ---------------------------------------------------------------------------

/**
 * Wyciąga obiekt JSON z odpowiedzi modelu.
 *
 * Odpowiednik `extractJSON` z `services/geminiService.ts`: model potrafi owinąć
 * JSON w ```json mimo `response_format`, a wtedy `JSON.parse` na surowym
 * tekście wywala całe generowanie.
 */
export const extractJson = (text: string): unknown => {
  if (!text) throw new Error('Model zwrócił pustą odpowiedź.');

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced && fenced[1] ? fenced[1].trim() : text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // Ostatnia próba: wytnij od pierwszego nawiasu do ostatniego domykającego.
    const firstBrace = candidate.indexOf('{');
    const firstBracket = candidate.indexOf('[');
    const start =
      firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
    const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Odpowiedź modelu nie zawiera poprawnego JSON-a.');
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }
};

// ---------------------------------------------------------------------------
// Klient
// ---------------------------------------------------------------------------

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Koszt w dolarach za milion tokenów.
 *
 * Liczby służą wyłącznie do logu — pozwalają odpowiedzieć na pytanie „ile
 * kosztuje jedna praca domowa", zanim rachunek odpowie za nas. Rozjazd
 * z cennikiem OpenAI zmienia log, nie zachowanie silnika.
 */
const COST_PER_MTOK: Readonly<Record<string, { input: number; output: number }>> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

const estimateCostUsd = (apiModel: string, promptTokens: number, completionTokens: number): number => {
  const rate = COST_PER_MTOK[apiModel];
  if (!rate) return 0;
  return (promptTokens * rate.input + completionTokens * rate.output) / 1_000_000;
};

/**
 * Buduje funkcję wywołującą model.
 *
 * Klucz przychodzi z sekretu Cloud Functions i nie opuszcza tego modułu.
 */
export const createOpenAiCall = (apiKey: string): ModelCall => {
  return async (request: ModelRequest): Promise<ModelResponse> => {
    if (!apiKey) throw new Error('Brak OPENAI_API_KEY — silnik v2 nie ma czym generować.');

    const errors: string[] = [];

    for (const logicalModel of V2_MODEL_CASCADE) {
      const apiModel = mapToActualOpenAIModel(logicalModel);
      const startedAt = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: apiModel,
            messages: [
              { role: 'system', content: `${request.system}\n\nOdpowiadaj wyłącznie poprawnym JSON-em.` },
              { role: 'user', content: request.user },
            ],
            // Niska domyślnie: układanie zadań ma być powtarzalne, a ocena
            // wręcz musi być. Kreatywność bierze się z materiału lekcji,
            // nie z losowości próbkowania.
            temperature: request.temperature ?? 0.3,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const latencyMs = Date.now() - startedAt;

        if (!response.ok) {
          const errText = await response.text();
          errors.push(`${logicalModel}: HTTP ${response.status}`);
          // Zły klucz albo wyczerpany limit nie naprawi się na kolejnym
          // modelu — to ten sam klucz i to samo konto.
          if (response.status === 401 || response.status === 429 || errText.includes('insufficient_quota')) {
            throw new Error(`OpenAI odmawia (${response.status}). Sprawdź OPENAI_API_KEY i limity konta.`);
          }
          continue;
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const content = payload.choices?.[0]?.message?.content || '';
        if (!content) {
          errors.push(`${logicalModel}: pusta odpowiedź`);
          continue;
        }

        const promptTokens = payload.usage?.prompt_tokens ?? 0;
        const completionTokens = payload.usage?.completion_tokens ?? 0;

        // Log kosztu i czasu — bez treści promptu i bez treści odpowiedzi.
        // Zlecenie mówi o tym wprost, a `aiMonitorService` z v1 trzyma
        // `promptSnippet`, czyli dokładnie to, czego tu być nie może.
        // `console` zamiast `firebase-functions/logger`: Cloud Functions v2
        // i tak zbiera wyjście konsoli do Cloud Logging, a dzięki temu ten
        // moduł nie zależy od pakietu funkcji i daje się testować z katalogu
        // głównego, gdzie `firebase-functions` nie jest zainstalowane.
        console.info('[hw-v2] wywołanie modelu', {
          taskName: request.taskName,
          model: logicalModel,
          apiModel,
          latencyMs,
          promptTokens,
          completionTokens,
          estimatedCostUsd: Number(estimateCostUsd(apiModel, promptTokens, completionTokens).toFixed(6)),
        });

        return { data: extractJson(content), modelUsed: logicalModel, latencyMs };
      } catch (error) {
        clearTimeout(timeoutId);
        const message = error instanceof Error ? error.message : String(error);
        // Błąd klucza/limitu przerywa kaskadę — nie ma sensu palić drugiego
        // wywołania na tę samą odmowę.
        if (message.includes('OpenAI odmawia')) throw error;
        errors.push(`${logicalModel}: ${message}`);
      }
    }

    throw new Error(`Żaden model nie odpowiedział. Próby: ${errors.join('; ')}`);
  };
};
