export function buildVocabularySetTitle(date: string, topic?: string): string {
  if (topic && topic.trim().length > 0) {
    return `${date} — ${topic.trim()}`;
  }
  return `${date} — Lesson vocabulary`;
}

export function countVocabularyItems(vocabularyText: string): number {
  if (!vocabularyText) return 0;
  
  return vocabularyText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .length;
}
