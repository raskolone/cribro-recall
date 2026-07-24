export interface SentenceItem {
  num: number;
  text: string;
}

/**
 * Normalizes prompt strings so that numbered sentences are always separated by newlines.
 */
export function normalizePromptLines(prompt: string): string {
  if (!prompt) return '';
  return prompt
    .replace(/([^\n])\s+(\d+[\.\)])\s+/g, '$1\n$2 ')
    .trim();
}

/**
 * Parses a prompt string into individual numbered items.
 * Handles both "1. Sentence... 2. Sentence..." and newline-separated inputs.
 */
export function parseNumberedItems(prompt: string): SentenceItem[] {
  if (!prompt) return [];

  const formatted = normalizePromptLines(prompt);
  const rawLines = formatted.split('\n').map(l => l.trim()).filter(Boolean);
  const items: SentenceItem[] = [];
  let currentNum = 1;

  for (const line of rawLines) {
    const match = line.match(/^(\d+)[\.\)]\s*(.+)$/);
    if (match) {
      items.push({
        num: parseInt(match[1], 10),
        text: match[2].trim()
      });
      currentNum = parseInt(match[1], 10) + 1;
    } else {
      if (items.length > 0) {
        items[items.length - 1].text += ' ' + line;
      } else {
        items.push({ num: currentNum++, text: line });
      }
    }
  }

  return items.length > 0 ? items : [{ num: 1, text: prompt.trim() }];
}

/**
 * Format answer strings when joining individual sub-answers
 */
export function formatSubAnswers(answersMap: Record<number, string>, totalCount: number): string {
  const resultLines: string[] = [];
  for (let i = 0; i < totalCount; i++) {
    const val = answersMap[i]?.trim() || '';
    resultLines.push(`${i + 1}. ${val}`);
  }
  return resultLines.join('\n');
}

/**
 * Parse an answer string like "1. Ans1\n2. Ans2" into map { 0: "Ans1", 1: "Ans2" }
 */
export function parseSubAnswers(answerStr: string, totalCount: number): Record<number, string> {
  const map: Record<number, string> = {};
  if (!answerStr) return map;

  const lines = answerStr.split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach((line, idx) => {
    const match = line.match(/^(\d+)[\.\)]\s*(.+)$/);
    if (match) {
      const num = parseInt(match[1], 10) - 1;
      map[num] = match[2].trim();
    } else {
      map[idx] = line;
    }
  });

  return map;
}
