import * as logger from 'firebase-functions/logger';

/**
 * Minimalny klient Notion API.
 *
 * Bez pakietu `@notionhq/client` — z całego SDK potrzebujemy dwóch wywołań
 * i paginacji, a to samo rozstrzygnięcie zapadło już przy Resend: zależność
 * trzeba potem utrzymywać, a `fetch` jest w Node 22 wbudowany.
 *
 * Wersja API jest przypięta. Notion wypuszcza zmiany łamiące zgodność pod
 * nowymi datami (wersja 2025-09-03 przebudowała bazy na „data sources"),
 * więc przypięcie jest tu zabezpieczeniem, a nie zaniedbaniem.
 */

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface NotionPage {
  id: string;
  url?: string;
  last_edited_time?: string;
  properties: Record<string, any>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (
  token: string,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<any> => {
  const maxRetries = 6;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    // Bezpieczny pacing między żądaniami do Notion API
    await sleep(350);

    const res = await fetch(`${NOTION_API}${path}`, {
      method: init?.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    if (res.status === 429) {
      let retryAfter = 16;
      try {
        const errJson: any = await res.json();
        if (errJson?.additional_data?.retry_after) {
          retryAfter = Number(errJson.additional_data.retry_after);
        }
      } catch {
        const header = res.headers.get('retry-after');
        if (header) retryAfter = Number(header);
      }
      logger.warn(`Notion rate limit (429) — oczekiwanie ${retryAfter + 1}s (próba ${attempt}/${maxRetries})`);
      await sleep((retryAfter + 1) * 1000);
      continue;
    }

    if (!res.ok) {
      const detail = await res.text();
      // Najczęstsza przyczyna 404 to nie literówka w identyfikatorze, tylko baza
      // nieudostępniona integracji — Notion nie odróżnia „nie ma" od „nie widzisz".
      throw new Error(
        `Notion ${init?.method || 'GET'} ${path} → ${res.status}: ${detail.slice(0, 400)}`
      );
    }

    return res.json();
  }

  throw new Error(`Przekroczono limit ponowień (${maxRetries}) dla Notion API (${path})`);
};

/** Wszystkie strony bazy, z przewijaniem kolejnych stron wyników. */
export const queryDatabase = async (
  token: string,
  databaseId: string,
  filter?: unknown
): Promise<NotionPage[]> => {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

    const data = await request(token, `/databases/${databaseId}/query`, {
      method: 'POST',
      body,
    });

    pages.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return pages;
};

/**
 * Treść strony jako tekst.
 *
 * Notion oddaje treść jako drzewo bloków, a podsumowanie lekcji siedzi wewnątrz
 * toggle „Podsumowanie lekcji" — czyli o poziom głębiej niż zwraca pojedyncze
 * wywołanie. Stąd zejście w dzieci, ograniczone głębokością: pętla po cyklicznej
 * strukturze kosztowałaby limit zapytań, a nic sensownego by nie wniosła.
 */
/**
 * Treść strony jako tekst zoptymalizowana pod podsumowania 4 bloków Notion.
 *
 * Pobiera bloki najwyższego poziomu oraz wchodzi w głąb toggle „Podsumowanie lekcji"
 * / „Learning Curve", pomijając zbędne wielostronicowe surowe transkrypcje.
 */
export const pageToText = async (
  token: string,
  blockId: string,
  depth = 0
): Promise<string> => {
  if (depth > 2) return '';

  const lines: string[] = [];
  let cursor: string | undefined;

  do {
    const query = cursor ? `?start_cursor=${cursor}&page_size=100` : '?page_size=100';
    const data = await request(token, `/blocks/${blockId}/children${query}`);

    for (const block of data.results || []) {
      const text = richTextOf(block);
      const lower = text.toLowerCase();
      if (text) lines.push(prefixFor(block.type, text));

      if (block.has_children && depth < 2) {
        // Wchodzimy w głąb toggle'i podsumowania, bloków lub calloutów
        const isSummaryToggle =
          block.type === 'toggle' &&
          (lower.includes('podsumowanie') ||
            lower.includes('blok') ||
            lower.includes('learning curve') ||
            lower.includes('key language') ||
            lower.includes('homework') ||
            lower.includes('lekcja w skrócie') ||
            lower.includes('next lesson') ||
            lower.includes('corrections'));

        const isStandardContainer = ['callout', 'quote'].includes(block.type);

        if (isSummaryToggle || isStandardContainer || depth === 0) {
          const nested = await pageToText(token, block.id, depth + 1);
          if (nested) lines.push(nested);
        }
      }
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return lines.join('\n');
};

/** Tekst bloku bez formatowania — do parsowania liczy się treść, nie styl. */
const richTextOf = (block: any): string => {
  const body = block?.[block?.type];
  const rich = body?.rich_text || body?.text;
  if (!Array.isArray(rich)) return '';
  return rich.map((part: any) => part?.plain_text || '').join('').trim();
};

/** Nagłówki i punkty odtwarzamy w markdownie, żeby podział na sekcje był czytelny. */
const prefixFor = (type: string, text: string): string => {
  if (type === 'heading_1') return `# ${text}`;
  if (type === 'heading_2') return `## ${text}`;
  if (type === 'heading_3') return `### ${text}`;
  if (type === 'bulleted_list_item') return `- ${text}`;
  if (type === 'numbered_list_item') return `1. ${text}`;
  if (type === 'toggle') return `## ${text}`;
  return text;
};

export const logNotionError = (context: string, error: unknown): void => {
  logger.error(`Notion: ${context}`, {
    error: error instanceof Error ? error.message : String(error),
  });
};
