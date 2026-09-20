import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchNotionBlocksText,
  NOTION_BLOCKS_MAX_DEPTH,
} from '../utils/notionBlocksFetcher';

/**
 * Prawdziwy pacing (350 ms) i backoff dla 429/5xx (do kilku sekund) między
 * wywołaniami Notion działają w produkcji, ale w testach mnożą się przez
 * liczbę bloków. Zegar zastępczy przewija je bez czekania — pętla dobija
 * małymi krokami, bo `setTimeout` rejestrowany w trakcie jednego wywołania
 * `tick()` nie jest tym samym tickiem obsługiwany, dopóki nie oddamy sterowania.
 */
async function withFakeTimers<T>(run: () => Promise<T>): Promise<T> {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const promise = run();
    let settled = false;
    promise.then(
      () => { settled = true; },
      () => { settled = true; }
    );
    for (let i = 0; i < 400 && !settled; i++) {
      await mock.timers.tick(50);
      await new Promise((resolve) => setImmediate(resolve));
    }
    return await promise;
  } finally {
    mock.timers.reset();
  }
}

/**
 * Pobieranie treści bloków Notion.
 *
 * Wcześniejsza wersja (`functions/src/notion/client.ts`) wchodziła tylko w
 * toggle dopasowane po słowie kluczowym oraz w callout/quote — inny typ bloku
 * z dziećmi (np. zwykły akapit z zagnieżdżonym akapitem, albo bulleted_list_item
 * z podpunktami) tracił całą zagnieżdżoną treść po cichu. Testy sprawdzają, że
 * `fetchNotionBlocksText` schodzi w KAŻDY blok z `has_children`, niezależnie od
 * typu i treści, a błędy API oraz przekroczenie głębokości kończą się
 * wyjątkiem — nigdy ciszej, uciętej treścią.
 */

type MockPage = {
  status: number;
  body?: any;
  text?: string;
  headers?: Record<string, string>;
};

const richTextBlock = (id: string, type: string, text: string, hasChildren = false) => ({
  id,
  type,
  has_children: hasChildren,
  [type]: { rich_text: [{ plain_text: text }] },
});

/**
 * Stub `fetch` kluczowany po `blockId` wyciągniętym z URL — każdy blockId ma
 * własną kolejkę odpowiedzi konsumowaną po kolei, więc test może modelować
 * paginację (kilka odpowiedzi dla tego samego blockId) niezależnie od kolejności
 * wywołań dla innych bloków.
 */
function installFetchStub(pagesByBlockId: Record<string, MockPage[]>) {
  const original = globalThis.fetch;
  const consumed: Record<string, number> = {};
  const calls: string[] = [];

  (globalThis as any).fetch = async (url: string) => {
    calls.push(url);
    const match = url.match(/\/blocks\/([^/]+)\/children/);
    const blockId = match ? match[1] : '';
    const queue = pagesByBlockId[blockId] || [];
    const idx = consumed[blockId] || 0;
    const page = queue[idx] ?? queue[queue.length - 1];
    consumed[blockId] = idx + 1;

    if (!page) {
      throw new Error(`Brak zamockowanej odpowiedzi dla blockId=${blockId}`);
    }

    return {
      ok: page.status >= 200 && page.status < 300,
      status: page.status,
      headers: { get: (name: string) => (page.headers || {})[name.toLowerCase()] ?? null },
      json: async () => page.body,
      text: async () => page.text ?? '',
    } as any;
  };

  return {
    calls,
    restore: () => {
      (globalThis as any).fetch = original;
    },
  };
}

test('schodzi w zagnieżdżenie toggle -> callout -> paragraph (nie tylko dopasowane słowem kluczowym)', async () => {
  const stub = installFetchStub({
    page: [
      { status: 200, body: { results: [richTextBlock('toggle-1', 'toggle', 'Losowy tytuł toggle', true)], has_more: false } },
    ],
    'toggle-1': [
      { status: 200, body: { results: [richTextBlock('callout-1', 'callout', 'Uwaga w callout', true)], has_more: false } },
    ],
    'callout-1': [
      { status: 200, body: { results: [richTextBlock('p-1', 'paragraph', 'Treść w środku')], has_more: false } },
    ],
  });

  try {
    const text = await withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0));
    assert.equal(text, 'Losowy tytuł toggle\nUwaga w callout\nTreść w środku');
  } finally {
    stub.restore();
  }
});

test('paginacja na poziomie root i na poziomie dziecka, osobny kursor dla każdego rodzica', async () => {
  const stub = installFetchStub({
    page: [
      { status: 200, body: { results: [richTextBlock('child-1', 'toggle', 'Rodzic', true)], has_more: true, next_cursor: 'root-cursor' } },
      { status: 200, body: { results: [richTextBlock('sibling', 'paragraph', 'Drugi element root')], has_more: false } },
    ],
    'child-1': [
      { status: 200, body: { results: [richTextBlock('c1', 'paragraph', 'Dziecko strona 1')], has_more: true, next_cursor: 'child-cursor' } },
      { status: 200, body: { results: [richTextBlock('c2', 'paragraph', 'Dziecko strona 2')], has_more: false } },
    ],
  });

  try {
    const text = await withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0));
    assert.equal(text, 'Rodzic\nDziecko strona 1\nDziecko strona 2\nDrugi element root');

    const rootCalls = stub.calls.filter((u) => u.includes('/blocks/page/children'));
    assert.equal(rootCalls.length, 2);
    assert.ok(rootCalls[1].includes('start_cursor=root-cursor'));

    const childCalls = stub.calls.filter((u) => u.includes('/blocks/child-1/children'));
    assert.equal(childCalls.length, 2);
    assert.ok(childCalls[1].includes('start_cursor=child-cursor'));
  } finally {
    stub.restore();
  }
});

test('kolejność bloków depth-first bez duplikacji: tekst rodzica, potem dzieci, potem rodzeństwo', async () => {
  const stub = installFetchStub({
    page: [
      {
        status: 200,
        body: {
          results: [
            richTextBlock('a', 'paragraph', 'A'),
            richTextBlock('b', 'toggle', 'B', true),
            richTextBlock('d', 'paragraph', 'D'),
          ],
          has_more: false,
        },
      },
    ],
    b: [{ status: 200, body: { results: [richTextBlock('c', 'paragraph', 'C')], has_more: false } }],
  });

  try {
    const text = await withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0));
    assert.equal(text, 'A\nB\nC\nD');
    assert.equal((text.match(/\bC\b/g) || []).length, 1);
  } finally {
    stub.restore();
  }
});

test('pusty wynik przy legalnym braku sekcji zwraca pusty string, nie błąd', async () => {
  const stub = installFetchStub({
    page: [{ status: 200, body: { results: [], has_more: false } }],
  });

  try {
    const text = await withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0));
    assert.equal(text, '');
  } finally {
    stub.restore();
  }
});

test('błąd po pierwszej stronie paginacji przerywa import bez zwracania częściowej treści', async () => {
  const stub = installFetchStub({
    page: [
      { status: 200, body: { results: [richTextBlock('a', 'paragraph', 'Pierwsza strona')], has_more: true, next_cursor: 'x' }, },
      { status: 404, text: 'Not shared with integration' },
    ],
  });

  try {
    await assert.rejects(() => withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0)), /404/);
  } finally {
    stub.restore();
  }
});

test('429 z Retry-After jest ponawiane i ostatecznie się kończy sukcesem', async () => {
  const stub = installFetchStub({
    page: [
      { status: 429, headers: { 'retry-after': '0' }, text: 'rate limited' },
      { status: 200, body: { results: [richTextBlock('a', 'paragraph', 'Po ponowieniu')], has_more: false } },
    ],
  });

  try {
    const text = await withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0));
    assert.equal(text, 'Po ponowieniu');
    assert.equal(stub.calls.length, 2);
  } finally {
    stub.restore();
  }
});

test('5xx wyczerpuje ponowienia (maks. 3 próby) i kończy się kontrolowanym błędem', async () => {
  const stub = installFetchStub({
    page: [
      { status: 503, text: 'upstream error' },
      { status: 503, text: 'upstream error' },
      { status: 503, text: 'upstream error' },
    ],
  });

  try {
    await assert.rejects(() => withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0)), /503/);
    assert.equal(stub.calls.length, 3);
  } finally {
    stub.restore();
  }
});

test('blok na głębokości MAX_DEPTH z dziećmi kończy się błędem, bez zapisu ucinanej treści', async () => {
  // page(0) -> l1(1) -> l2(2) -> l3(3) -> l4(depth 4, ma dzieci) => błąd
  const stub = installFetchStub({
    page: [{ status: 200, body: { results: [richTextBlock('l1', 'toggle', 'L1', true)], has_more: false } }],
    l1: [{ status: 200, body: { results: [richTextBlock('l2', 'toggle', 'L2', true)], has_more: false } }],
    l2: [{ status: 200, body: { results: [richTextBlock('l3', 'toggle', 'L3', true)], has_more: false } }],
    l3: [{ status: 200, body: { results: [richTextBlock('l4', 'toggle', 'L4', true)], has_more: false } }],
  });

  try {
    assert.equal(NOTION_BLOCKS_MAX_DEPTH, 4);
    await assert.rejects(() => withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0)), /głębokości 4/);
  } finally {
    stub.restore();
  }
});

test('blok dokładnie na dozwolonej głębokości (3) z dziećmi na głębokości 4 wciąż działa', async () => {
  // page(0) -> l1(1) -> l2(2) -> l3(3, ma dzieci) -> l4(4, BEZ dzieci) — dozwolone
  const stub = installFetchStub({
    page: [{ status: 200, body: { results: [richTextBlock('l1', 'toggle', 'L1', true)], has_more: false } }],
    l1: [{ status: 200, body: { results: [richTextBlock('l2', 'toggle', 'L2', true)], has_more: false } }],
    l2: [{ status: 200, body: { results: [richTextBlock('l3', 'toggle', 'L3', true)], has_more: false } }],
    l3: [{ status: 200, body: { results: [richTextBlock('l4', 'paragraph', 'L4 liść')], has_more: false } }],
  });

  try {
    const text = await withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0));
    assert.equal(text, 'L1\nL2\nL3\nL4 liść');
  } finally {
    stub.restore();
  }
});

test('brak wyjątków przy brakujących/pustych polach rich_text i nieznanym typie bloku', async () => {
  const weird = [
    { id: 'no-type', has_children: false },
    { id: 'unknown-type', type: 'unsupported_embed', has_children: false, unsupported_embed: {} },
    { id: 'empty-rich-text', type: 'paragraph', has_children: false, paragraph: { rich_text: [] } },
    { id: 'null-part', type: 'paragraph', has_children: false, paragraph: { rich_text: [null, { plain_text: 'Ocalały tekst' }] } },
  ];

  const stub = installFetchStub({
    page: [{ status: 200, body: { results: weird, has_more: false } }],
  });

  try {
    const text = await withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0));
    assert.equal(text, 'Ocalały tekst');
  } finally {
    stub.restore();
  }
});

test('prawdziwy tekst kursanta zawierający słowo "apple" przechodzi bez zmian (brak filtrowania po fallbacku)', async () => {
  const stub = installFetchStub({
    page: [
      {
        status: 200,
        body: {
          results: [richTextBlock('v1', 'bulleted_list_item', 'an apple a day — codzienne powiedzonko kursanta')],
          has_more: false,
        },
      },
    ],
  });

  try {
    const text = await withFakeTimers(() => fetchNotionBlocksText('token', 'page', 0));
    assert.equal(text, 'an apple a day — codzienne powiedzonko kursanta');
  } finally {
    stub.restore();
  }
});
