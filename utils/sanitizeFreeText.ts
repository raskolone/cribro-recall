/**
 * Tekst od kursanta → bezpieczny fragment danych dla promptu (i czytelny temat na ekranie).
 *
 * NFKC, tylko litery/cyfry/znaki łączące/spacja i podstawowa interpunkcja (bez `<`, `>`, nawiasów
 * klamrowych i kwadratowych, backticków i znaków nowej linii — nie da się zamknąć ogranicznika ani
 * wstrzyknąć struktury), pojedyncze spacje, obcięty do `maxLength` znaków. Ta sama funkcja działa
 * na kliencie (pole tematu) i na serwerze (prompt), więc to, co kursant widzi, to to, co dostaje model.
 */
export function sanitizeFreeText(raw: unknown, maxLength: number): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\p{M} .,;:!?'’"()\-–/&+%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, Math.max(0, maxLength)).join('').trim();
}
