export function cleanVocabularyTopic(topic?: string): string {
  if (!topic) return '';
  return topic
    .replace(/^\[Lekcja\]\s*/i, '')
    .replace(/^(Lekcja|Lesson)\s*#?\d+[\s:\-–]*/i, '')
    .replace(/\((Lekcja|Lesson)\s*#?\d+\)\s*/gi, '')
    .replace(/^Słownictwo\s+z\s+lekcji[\s:\-–]*/i, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
}

export function buildVocabularySetTitle(date: string, topic?: string): string {
  const cleaned = cleanVocabularyTopic(topic);
  if (cleaned.length > 0) {
    return cleaned;
  }
  return date;
}

export function countVocabularyItems(vocabularyText: string): number {
  if (!vocabularyText) return 0;
  
  return vocabularyText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .length;
}

