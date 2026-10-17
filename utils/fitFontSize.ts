/**
 * Dopasowanie rozmiaru czcionki do stałego pola (karta fiszki). Czysta funkcja: bez DOM, więc da się
 * ją testować w node. Szerokość znaku to oszacowanie (średnia dla pogrubionego kroju bezszeryfowego),
 * a hook `useFitFontSize` po wyliczeniu dodatkowo sprawdza realny `scrollHeight`.
 */

export interface FitFontSizeInput {
  text: string;
  /** Wymiary pola na tekst w px. */
  width: number;
  height: number;
  /** Zakres rozmiarów w px (max ≥ min). */
  maxSize: number;
  minSize: number;
  /** Interlinia (mnożnik rozmiaru). */
  lineHeight?: number;
  /** Średnia szerokość znaku jako ułamek rozmiaru czcionki. */
  charWidth?: number;
}

export interface FitFontSizeResult {
  size: number;
  /** Tekst nie mieści się nawet przy minimum — pole ma się przewijać. */
  overflow: boolean;
}

/** HTML fiszki → zwykły tekst do pomiaru (znaczniki nie zajmują miejsca). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Liczba linii po zawinięciu na słowach; wyraz dłuższy niż linia łamie się w środku (break-words). */
export function estimateLineCount(text: string, charsPerLine: number): number {
  const perLine = Math.max(1, Math.floor(charsPerLine));
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines += 1;
      continue;
    }
    let current = 0;
    let used = 1;
    for (const word of words) {
      let len = word.length;
      if (len > perLine) {
        // Zaczyna od nowej linii, dalej tnie co `perLine` znaków.
        if (current > 0) used += 1;
        used += Math.ceil(len / perLine) - 1;
        current = len % perLine === 0 ? perLine : len % perLine;
        continue;
      }
      if (current === 0) current = len;
      else if (current + 1 + len <= perLine) current += 1 + len;
      else {
        used += 1;
        current = len;
      }
    }
    lines += used;
  }
  return lines;
}

export function computeFitFontSize({
  text,
  width,
  height,
  maxSize,
  minSize,
  lineHeight = 1.2,
  charWidth = 0.6,
}: FitFontSizeInput): FitFontSizeResult {
  const max = Math.max(maxSize, minSize);
  const min = Math.min(maxSize, minSize);
  if (!(width > 0) || !(height > 0)) return { size: max, overflow: false };
  const plain = text.trim();
  if (plain === '') return { size: max, overflow: false };

  const fits = (size: number) => {
    const lines = estimateLineCount(plain, width / (size * charWidth));
    return lines * size * lineHeight <= height;
  };

  if (fits(max)) return { size: max, overflow: false };
  if (!fits(min)) return { size: min, overflow: true };

  // Największy mieszczący się rozmiar (fits jest monotoniczne malejąco), krok 0,25 px.
  let lo = min;
  let hi = max;
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return { size: Math.floor(lo * 4) / 4, overflow: false };
}
