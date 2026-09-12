/**
 * Wyciąganie listy z odpowiedzi modelu.
 *
 * Powód istnienia tego pliku jest konkretny. Generator testów prosił model
 * o tablicę JSON i sprawdzał wynik przez `Array.isArray`. Działało to, dopóki
 * pierwszym modelem w kaskadzie był Gemini: `responseSchema` typu ARRAY
 * sprawia, że Gemini oddaje gołą tablicę.
 *
 * Gdy na czoło kaskady wszedł model OpenAI (`services/aiModels.ts`), ścieżka
 * OpenAI w `server.ts` zaczęła wymuszać `response_format: { type: 'json_object' }`.
 * Ten tryb **z definicji zwraca obiekt** — OpenAI nie odda w nim gołej tablicy,
 * choćby prompt prosił o to dziesięć razy. Model zwracał więc poprawny JSON
 * w kształcie `{"questions": [...]}`, a `Array.isArray` mówiło „nie" i lektor
 * dostawał „Model nie zwrócił poprawnej listy zadań".
 *
 * Stąd ten helper: akceptuje oba kształty, bo oba są poprawnymi odpowiedziami
 * — zależnie od tego, który dostawca akurat odpowiedział.
 */

/** Zdejmuje płot ```json, którym model potrafi owinąć odpowiedź mimo instrukcji. */
const stripFence = (raw: string): string =>
  raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/```\s*$/g, '')
    .trim();

/**
 * Zwraca listę z odpowiedzi modelu albo `null`, jeśli listy tam nie ma.
 *
 * Akceptowane kształty:
 * - goła tablica: `[{...}, {...}]` — tak odpowiada Gemini z `responseSchema`,
 * - obiekt z jedną tablicą w środku: `{"questions": [...]}`, `{"tasks": [...]}`
 *   — tak odpowiada OpenAI w trybie `json_object`.
 *
 * Obiekt z kilkoma tablicami jest odrzucany świadomie: nie da się wtedy
 * rozstrzygnąć, która jest tą właściwą, a zgadywanie oznaczałoby test złożony
 * z przypadkowego pola.
 */
export const extractListFromModelJson = (raw?: string | null): any[] | null => {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(stripFence(String(raw)));
  } catch {
    return null;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value : null;
  }

  if (value && typeof value === 'object') {
    const arrays = Object.values(value as Record<string, unknown>).filter(
      (v): v is any[] => Array.isArray(v) && v.length > 0
    );
    if (arrays.length === 1) return arrays[0];
  }

  return null;
};
