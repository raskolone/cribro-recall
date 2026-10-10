/**
 * Bezpieczne podświetlenie błędów w odpowiedzi AI.
 *
 * Model zwraca fragment HTML („<span class='text-red-500 font-bold'>…</span>"), a kursant
 * wpisuje własny tekst, który trafia do tego samego pola — więc przed `dangerouslySetInnerHTML`
 * zostawiamy WYŁĄCZNIE znaczniki span/b/strong/em z klasami z krótkiej białej listy (reszta,
 * także atrybuty, skrypty i obrazki, jest zamieniana na zwykły tekst). Klasa modelu
 * `text-red-500` jest mapowana na token `text-danger` (kontrast AA w obu motywach) i dostaje
 * podkreślenie — kolor nie jest jedynym sygnałem.
 */
const ALLOWED_TAGS = new Set(['span', 'b', 'strong', 'em']);
const CLASS_MAP: Record<string, string> = {
  'text-red-500': 'text-danger underline decoration-2',
  'text-danger': 'text-danger underline decoration-2',
  'font-bold': 'font-bold',
  'font-semibold': 'font-semibold',
  underline: 'underline',
  italic: 'italic',
};

const escapeText = (text: string): string =>
  text
    .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+class\s*=\s*(?:'[^'<>]*'|"[^"<>]*"))?)\s*>/g;

export function sanitizeHighlightHtml(input: unknown): string {
  const html = typeof input === 'string' ? input : '';
  let out = '';
  let last = 0;
  const open: string[] = [];
  for (const match of html.matchAll(TAG)) {
    const [whole, slash, rawName, classAttr] = match;
    const index = match.index ?? 0;
    out += escapeText(html.slice(last, index));
    last = index + whole.length;
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) {
      out += escapeText(whole);
      continue;
    }
    if (slash) {
      // Zamykamy tylko to, co otworzyliśmy — niesparowany </span> staje się tekstem.
      if (open[open.length - 1] === name) {
        open.pop();
        out += `</${name}>`;
      } else {
        out += escapeText(whole);
      }
      continue;
    }
    const rawClasses = classAttr ? classAttr.replace(/^\s+class\s*=\s*/i, '').slice(1, -1).split(/\s+/) : [];
    const classes = rawClasses.map((c) => CLASS_MAP[c]).filter(Boolean).join(' ');
    open.push(name);
    out += classes ? `<${name} class="${classes}">` : `<${name}>`;
  }
  out += escapeText(html.slice(last));
  while (open.length) out += `</${open.pop()}>`;
  return out;
}
