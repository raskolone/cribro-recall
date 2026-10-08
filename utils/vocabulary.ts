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


/**
 * Materiał, z którego wolno budować powtórki.
 *
 * Zwraca tekst w tym samym formacie co `vocabularyText`, żeby wszystkie miejsca
 * parsujące słownictwo działały bez zmian — różnica jest wyłącznie w tym, ile
 * linii dostają. Brak `approvedItems` (starsze zestawy) oznacza cały wklej.
 */
export function getApprovedVocabularyText(set: {
  vocabularyText?: string;
  approvedItems?: string[];
}): string {
  // Rozróżnienie jest tu istotne: pusta tablica znaczy „nic nie zatwierdzono",
  // a brak pola — „zestaw sprzed wprowadzenia zatwierdzania, bierz całość".
  // Potraktowanie pustej tablicy jak braku pola cofałoby odznaczenie wszystkiego.
  if (Array.isArray(set.approvedItems)) {
    return set.approvedItems.join('\n');
  }
  return set.vocabularyText || '';
}

/** Linie wklejonego słownictwa, w kolejności zapisu, bez pustych. */
export function splitVocabularyLines(vocabularyText: string): string[] {
  if (!vocabularyText) return [];
  return vocabularyText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

export function parseVocabularyTextToCards(vocabularyText: string) {
  if (!vocabularyText) return [];
  const lines = vocabularyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.map((line, idx) => {
    let term = line;
    let definition = '';
    if (line.includes(' - ')) {
      const parts = line.split(' - ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' - ').trim();
    } else if (line.includes(' – ')) {
      const parts = line.split(' – ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' – ').trim();
    } else if (line.includes(' — ')) {
      // Myślnik em: tym separatorem zapisuje słownictwo skill „Meeting Summary”
      // w Notion, więc bez tej gałęzi każda zaimportowana pozycja trafiałaby
      // do bazy jako termin bez tłumaczenia.
      const parts = line.split(' — ');
      term = parts[0].trim();
      definition = parts.slice(1).join(' — ').trim();
    } else if (line.includes(':')) {
      const parts = line.split(':');
      term = parts[0].trim();
      definition = parts.slice(1).join(':').trim();
    } else if (line.includes('=')) {
      const parts = line.split('=');
      term = parts[0].trim();
      definition = parts.slice(1).join('=').trim();
    }
    return {
      position: idx,
      term,
      definition,
      termLanguage: 'English',
      definitionLanguage: 'Polish'
    };
  });
}
