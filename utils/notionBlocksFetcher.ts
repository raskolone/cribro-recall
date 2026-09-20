/**
 * Pobieranie treści drzewa bloków Notion (`blocks.children.list`) na potrzeby
 * importu notatek i transkrypcji lekcji.
 *
 * Wydzielone z `server.ts`, żeby dało się to przetestować bez uruchamiania
 * całej aplikacji Express — jedyna zależność to globalny `fetch`, więc test
 * podmienia go zamiast mockować cały serwer.
 *
 * Błąd API (429 po wyczerpaniu ponowień, 5xx, przekroczona głębokość) zawsze
 * kończy się wyjątkiem, nigdy cichym zwróceniem pustego lub uciętego tekstu —
 * inaczej lektor dostaje notatkę, która wygląda na pustą lekcję, zamiast
 * informacji, że pobieranie się nie powiodło.
 */

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/** Root strony to głębokość 0 — do czterech poziomów zagnieżdżenia dzieci. */
export const NOTION_BLOCKS_MAX_DEPTH = 4;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Jedna strona `blocks.children.list`, z pacingiem (350 ms) przed każdym
 * żądaniem i ponowieniami dla 429/5xx (maks. 3 próby łącznie, z poszanowaniem
 * `Retry-After` dla 429).
 */
export const fetchNotionBlockChildrenPage = async (
  token: string,
  blockId: string,
  cursor: string | undefined
): Promise<any> => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(350);

    const url = `${NOTION_API}/blocks/${blockId}/children${cursor ? `?start_cursor=${cursor}&page_size=100` : '?page_size=100'}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) return res.json();

    const isRetryable = res.status === 429 || res.status >= 500;
    if (isRetryable && attempt < maxAttempts) {
      let retryAfterSeconds = 1;
      const header = res.headers.get('retry-after');
      if (header) retryAfterSeconds = Number(header) || retryAfterSeconds;
      await sleep((retryAfterSeconds + 1) * 1000);
      continue;
    }

    const detail = await res.text().catch(() => '');
    // Notion nie odróżnia "nie ma" od "nie masz dostępu" — 404 najczęściej
    // znaczy, że strona nie jest udostępniona integracji.
    throw new Error(`Notion GET /blocks/${blockId}/children → ${res.status}: ${detail.slice(0, 400)}`);
  }

  throw new Error(`Notion: przekroczono limit ponowień dla /blocks/${blockId}/children`);
};

/** Tekst bloku bez formatowania — defensywnie, bo nie każdy typ ma `rich_text`. */
const richTextOf = (block: any): string => {
  const type = block?.type;
  const body = type ? block[type] : undefined;
  const richText = body?.rich_text;
  if (!Array.isArray(richText)) return '';
  return richText.map((part: any) => part?.plain_text || '').join('');
};

/**
 * Tekst strony/bloku Notion, ze zejściem w dzieci do `NOTION_BLOCKS_MAX_DEPTH`.
 *
 * Rekurencja jest bezwarunkowa dla każdego bloku z `has_children` — nie tylko
 * dla toggle czy callout — bo notatki i transkrypcje zagnieżdżają treść w
 * dowolnym typie bloku. Blok bez rozpoznanego typu tekstowego nie przerywa
 * przetwarzania: liczy się to, czy ma dzieci, nie czy sam ma tekst.
 */
export const fetchNotionBlocksText = async (
  token: string,
  blockId: string,
  depth = 0
): Promise<string> => {
  const lines: string[] = [];
  let cursor: string | undefined;

  do {
    const data: any = await fetchNotionBlockChildrenPage(token, blockId, cursor);

    for (const block of data?.results || []) {
      if (!block || typeof block !== 'object') continue;

      const text = richTextOf(block);
      if (text) lines.push(text);

      if (block.has_children) {
        const childDepth = depth + 1;
        if (childDepth >= NOTION_BLOCKS_MAX_DEPTH) {
          // Blok na głębokości MAX_DEPTH nie może mieć dzieci — zejście o
          // poziom niżej przekroczyłoby limit, więc to kontrolowany błąd,
          // a nie po cichu ucięta treść.
          throw new Error(
            `Notion: blok na głębokości ${childDepth} nadal ma dzieci — przekroczono limit MAX_DEPTH=${NOTION_BLOCKS_MAX_DEPTH} dla bloku ${block.id}`
          );
        }
        const childText = await fetchNotionBlocksText(token, block.id, childDepth);
        if (childText) lines.push(childText);
      }
    }

    cursor = data?.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return lines.join('\n');
};
