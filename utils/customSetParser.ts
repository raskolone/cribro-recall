/**
 * Parsowanie par słowo - tłumaczenie do tworzenia własnych zestawów fiszek.
 * Obsługuje wpisywanie ręczne oraz wklejanie wielu linii (z Google Docs, Notion, Quizlet, Anki).
 */

export interface WordPair {
  term: string;
  definition: string;
}

export interface ParseWordPairsResult {
  valid: WordPair[];
  invalidLines: string[];
}

export function parseWordPairs(text: string): ParseWordPairsResult {
  if (!text || typeof text !== 'string') {
    return { valid: [], invalidLines: [] };
  }

  const lines = text.split('\n');
  const valid: WordPair[] = [];
  const invalidLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Usunięcie wiodącej numeracji, myślników, punktorów: np. "1. ", "• ", "- ", "* "
    const cleanLine = trimmed.replace(/^[\s\*\-\•\d\.]+\s*/, '').trim();
    if (!cleanLine) continue;

    // Szukanie separatora:
    // 1) Spacja wokół separatora: "word - translation", "word : translation"
    // 2) Tabulator: "word\ttranslation"
    // 3) Dwukropek lub znak równości: "word:translation", "word=translation"
    // 4) Myślniki / półpauzy bez spacji: "word-translation"
    const match =
      cleanLine.match(/\s+[\-\–\—\:=]\s+/) ||
      cleanLine.match(/\t+/) ||
      cleanLine.match(/[\:\=]/) ||
      cleanLine.match(/\s*[\-\–\—]\s*/);

    if (match && match.index !== undefined) {
      const term = cleanLine.substring(0, match.index).trim();
      const definition = cleanLine.substring(match.index + match[0].length).trim();
      if (term.length > 0 && definition.length > 0) {
        valid.push({ term, definition });
        continue;
      }
    }

    invalidLines.push(rawLine);
  }

  return { valid, invalidLines };
}
