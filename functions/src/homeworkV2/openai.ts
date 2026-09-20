/**
 * Wywołanie modeli AI dla silnika v2.
 *
 * Podstawowym dostawcą dla generowania i oceny prac domowych v2 jest **Gemini 2.5 Flash**
 * (`gemini-2.5-flash`), co zapewnia błyskawiczny czas odpowiedzi, wysoką dokładność
 * oraz brak uzależnienia od awarii lub braku klucza OpenAI.
 *
 * W przypadku niedostępności Gemini lub braku klucza, kaskada przechodzi do modeli
 * zapasowych (Gemini / OpenAI gpt-4o-mini).
 */

// ---------------------------------------------------------------------------
// Modele
// ---------------------------------------------------------------------------

/** Nazwa logiczna modelu wiodącego (Gemini 2.5 Flash). */
export const V2_PRIMARY_MODEL = 'gemini-2.5-flash';

/** Zapas w rodzinie Gemini. */
export const V2_FALLBACK_MODEL = 'gemini-3.8-flash';

/** Zapas u drugiego dostawcy (OpenAI). */
export const V2_TERTIARY_MODEL = 'gpt-4o-mini';

/**
 * Kaskada v2. Zaczyna od Gemini 2.5 Flash, potem zapas Gemini i OpenAI.
 */
export const V2_MODEL_CASCADE: readonly string[] = [
  V2_PRIMARY_MODEL,
  V2_FALLBACK_MODEL,
  V2_TERTIARY_MODEL,
] as const;

/**
 * Przekład nazwy logicznej na realny endpoint OpenAI.
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
  openAiApiKey?: string;
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

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 60_000;

const COST_PER_MTOK: Readonly<Record<string, { input: number; output: number }>> = {
  'gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

const estimateCostUsd = (apiModel: string, promptTokens: number, completionTokens: number): number => {
  const rate = COST_PER_MTOK[apiModel];
  if (!rate) return 0;
  return (promptTokens * rate.input + completionTokens * rate.output) / 1_000_000;
};

/**
 * Buduje funkcję wywołującą modele z kaskadą (Gemini Flash 2.5 → OpenAI).
 */
export const createAiCall = (keys: AiCallKeys): ModelCall => {
  return async (request: ModelRequest): Promise<ModelResponse> => {
    const geminiKey = (keys.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
    const openAiKey = (keys.openAiApiKey || process.env.OPENAI_API_KEY || '').trim();

    if (!geminiKey && !openAiKey) {
      throw new Error('Brak kluczy GEMINI_API_KEY oraz OPENAI_API_KEY — silnik v2 nie ma czym generować.');
    }

    const errors: string[] = [];

    for (const logicalModel of V2_MODEL_CASCADE) {
      const isGemini = logicalModel.startsWith('gemini');
      const startedAt = Date.now();

      if (isGemini) {
        if (!geminiKey) {
          errors.push(`${logicalModel}: brak GEMINI_API_KEY`);
          continue;
        }

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
      } else {
        // OpenAI Fallback
        if (!openAiKey) {
          errors.push(`${logicalModel}: brak OPENAI_API_KEY`);
          continue;
        }

        const apiModel = mapToActualOpenAIModel(logicalModel);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
              model: apiModel,
              messages: [
                { role: 'system', content: `${request.system}\n\nOdpowiadaj wyłącznie poprawnym JSON-em.` },
                { role: 'user', content: request.user },
              ],
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
            if (response.status === 401 || response.status === 429 || errText.includes('insufficient_quota')) {
              // Jeżeli to nie był jedyny dostępny model, logujemy i przechodzimy dalej
              errors.push(`OpenAI odmawia (${response.status}). Sprawdź OPENAI_API_KEY i limity konta.`);
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

          console.info('[hw-v2] wywołanie modelu OpenAI', {
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
    }

    throw new Error(`Żaden model nie odpowiedział. Próby: ${errors.join('; ')}`);
  };
};

/** Kompatybilność wsteczna — pojedynczy klucz OpenAI */
export const createOpenAiCall = (apiKey: string): ModelCall => {
  return createAiCall({ openAiApiKey: apiKey });
};
