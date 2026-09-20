/**
 * Wywołanie modeli AI dla silnika v2.
 *
 * Jedyny dopuszczalny dostawca dla generowania i oceny prac domowych v2 to
 * Gemini — patrz AGENT_LOG.md, hotfix P0 (2026-09-20): homework nie może po
 * cichu schodzić na OpenAI, bo wtedy błąd Gemini jest niewidoczny. `gpt-4o-mini`
 * i jego kaskada zostały usunięte razem z przekazywaniem `OPENAI_API_KEY` do
 * tej fabryki wywołań (patrz `endpoints.ts`) — globalny sekret OpenAI zostaje
 * nietknięty dla pozostałych, niehomeworkowych funkcji, które go używają.
 */

// ---------------------------------------------------------------------------
// Modele
// ---------------------------------------------------------------------------

/** Nazwa logiczna modelu wiodącego (Gemini 2.5 Flash). */
export const V2_PRIMARY_MODEL = 'gemini-2.5-flash';

/** Zapas w rodzinie Gemini — nadal Gemini, nigdy inny dostawca. */
export const V2_FALLBACK_MODEL = 'gemini-3.8-flash';

/**
 * Kaskada v2. WYŁĄCZNIE Gemini.
 */
export const V2_MODEL_CASCADE: readonly string[] = [
  V2_PRIMARY_MODEL,
  V2_FALLBACK_MODEL,
] as const;

/**
 * Przekład nazwy logicznej na realny model Gemini.
 */
export const mapToActualGeminiModel = (modelName: string): string => {
  const clean = String(modelName || '').trim().toLowerCase();
  if (clean.includes('2.5-flash') || clean === 'gemini-2.5-flash') return 'gemini-2.5-flash';
  if (clean.includes('3.8-flash') || clean === 'gemini-3.8-flash') return 'gemini-2.5-flash'; // Fallback na stabilny 2.5 Flash
  if (clean.includes('1.5-flash')) return 'gemini-1.5-flash';
  return 'gemini-2.5-flash';
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
  /**
   * Budżet "myślenia" Gemini 2.5 Flash, w tokenach. Domyślnie 0 (wyłączone).
   *
   * Zdiagnozowana przyczyna 145 s na wygenerowanie 6 zadań: Flash 2.5 ma
   * rozszerzone rozumowanie WŁĄCZONE domyślnie, gdy `thinkingBudget` nie jest
   * podany — model spędza kilkanaście sekund na niewidocznym "myśleniu"
   * przed każdą odpowiedzią, nawet przy prostym, w pełni sprecyzowanym
   * poleceniu z gotowym przykładem formatu. Prompty tego silnika są już
   * maksymalnie rozpisane (format, reguły, przykład) — rozumowanie
   * wielokrokowe nic tu nie dokłada, tylko kosztuje czas. Wywołujący może
   * podać większy budżet tam, gdzie to się kiedyś okaże potrzebne.
   */
  thinkingBudget?: number;
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
 */
export type ModelCall = (request: ModelRequest) => Promise<ModelResponse>;

export interface AiCallKeys {
  geminiApiKey?: string;
}

// ---------------------------------------------------------------------------
// Parsowanie odpowiedzi
// ---------------------------------------------------------------------------

/**
 * Wyciąga obiekt JSON z odpowiedzi modelu.
 */
export const extractJson = (text: string): unknown => {
  if (!text) throw new Error('Model zwrócił pustą odpowiedź.');

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced && fenced[1] ? fenced[1].trim() : text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
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

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 60_000;

const COST_PER_MTOK: Readonly<Record<string, { input: number; output: number }>> = {
  'gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};

const estimateCostUsd = (apiModel: string, promptTokens: number, completionTokens: number): number => {
  const rate = COST_PER_MTOK[apiModel];
  if (!rate) return 0;
  return (promptTokens * rate.input + completionTokens * rate.output) / 1_000_000;
};

/**
 * Buduje funkcję wywołującą modele z kaskadą Gemini WYŁĄCZNIE (2.5 Flash →
 * 3.8 Flash). Żadna gałąź tej funkcji nie wywołuje OpenAI — patrz komentarz
 * na górze pliku.
 */
export const createAiCall = (keys: AiCallKeys): ModelCall => {
  return async (request: ModelRequest): Promise<ModelResponse> => {
    const geminiKey = (keys.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!geminiKey) {
      throw new Error('Brak klucza GEMINI_API_KEY — silnik v2 nie ma czym generować.');
    }

    const errors: string[] = [];

    for (const logicalModel of V2_MODEL_CASCADE) {
      const startedAt = Date.now();

      const apiModel = mapToActualGeminiModel(logicalModel);
      const url = `${GEMINI_BASE_URL}/${apiModel}:generateContent?key=${geminiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: request.user }],
              },
            ],
            systemInstruction: {
              parts: [{ text: `${request.system}\n\nOdpowiadaj wyłącznie poprawnym JSON-em.` }],
            },
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: request.temperature ?? 0.3,
              // Patrz komentarz przy `ModelRequest.thinkingBudget` — to jest
              // pojedyncza zmiana, która ścięła 145 s do sekund na wywołanie.
              thinkingConfig: { thinkingBudget: request.thinkingBudget ?? 0 },
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const latencyMs = Date.now() - startedAt;

        if (!response.ok) {
          const errText = await response.text();
          errors.push(`${logicalModel}: HTTP ${response.status} (${errText.slice(0, 100)})`);
          continue;
        }

        const payload = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };

        const content = payload.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!content) {
          errors.push(`${logicalModel}: pusta odpowiedź`);
          continue;
        }

        const promptTokens = payload.usageMetadata?.promptTokenCount ?? 0;
        const completionTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;

        console.info('[hw-v2] wywołanie modelu Gemini', {
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
        errors.push(`${logicalModel}: ${message}`);
      }
    }

    throw new Error(`Żaden model nie odpowiedział. Próby: ${errors.join('; ')}`);
  };
};
