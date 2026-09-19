import { writeFileSync } from 'node:fs';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const DEFAULT_NOTION_STUDENTS_DB = 'ca88a293-bd34-4cc7-b09e-f6bd3901ef96';
const DEFAULT_NOTION_LESSONS_DB = '5c6d910b-31b7-83b8-810c-0187aa513b51';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function notionRequest(token, path, init = {}) {
  const maxRetries = 6;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    // Basic rate limit pacing: 320ms delay
    await sleep(320);

    const res = await fetch(`${NOTION_API}${path}`, {
      method: init.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    if (res.status === 429) {
      let retryAfter = 16;
      try {
        const errJson = await res.json();
        if (errJson?.additional_data?.retry_after) {
          retryAfter = Number(errJson.additional_data.retry_after);
        }
      } catch {
        const header = res.headers.get('retry-after');
        if (header) retryAfter = Number(header);
      }
      console.warn(`[Notion 429 Rate Limit] Oczekiwanie ${retryAfter + 1}s przed ponowieniem próby ${attempt}/${maxRetries}...`);
      await sleep((retryAfter + 1) * 1000);
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Notion API error (${res.status}): ${errText.slice(0, 300)}`);
    }

    return await res.json();
  }

  throw new Error(`Przekroczono limit ponowień (${maxRetries}) dla ścieżki ${path}`);
}

async function queryDatabase(token, databaseId, filter) {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

    const data = await notionRequest(token, `/databases/${databaseId}/query`, {
      method: 'POST',
      body,
    });
    pages.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

const richTextOf = (block) => {
  const body = block?.[block?.type];
  const rich = body?.rich_text || body?.text;
  if (!Array.isArray(rich)) return '';
  return rich.map((part) => part?.plain_text || '').join('').trim();
};

const prefixFor = (type, text) => {
  if (type === 'heading_1') return `# ${text}`;
  if (type === 'heading_2') return `## ${text}`;
  if (type === 'heading_3') return `### ${text}`;
  if (type === 'bulleted_list_item') return `- ${text}`;
  if (type === 'numbered_list_item') return `1. ${text}`;
  if (type === 'toggle') return `## ${text}`;
  return text;
};

async function pageToText(token, blockId, depth = 0) {
  if (depth > 2) return '';
  const lines = [];
  let cursor;
  do {
    const query = cursor ? `?start_cursor=${cursor}&page_size=100` : '?page_size=100';
    const data = await notionRequest(token, `/blocks/${blockId}/children${query}`);
    for (const block of data.results || []) {
      const text = richTextOf(block);
      const lower = text.toLowerCase();
      if (text) lines.push(prefixFor(block.type, text));
      if (block.has_children && depth < 2) {
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
}

const propText = (page, name) => {
  const prop = page.properties?.[name];
  if (!prop) return '';
  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return (prop[prop.type] || []).map((p) => p.plain_text || '').join('').trim();
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return (prop.multi_select || []).map((o) => o.name).join(', ');
    case 'date':
      return prop.date?.start || '';
    case 'email':
      return prop.email || '';
    default:
      return '';
  }
};

const propRelationIds = (page, name) => {
  const prop = page.properties?.[name];
  if (prop?.type !== 'relation') return [];
  return (prop.relation || []).map((r) => r.id).filter(Boolean);
};

const propEmails = (page, name) => {
  const prop = page.properties?.[name];
  if (prop?.type === 'multi_select') {
    return (prop.multi_select || []).map((o) => (o.name || '').trim()).filter(Boolean);
  }
  const single = propText(page, name).trim();
  return single ? [single] : [];
};

/**
 * Pobiera świeży stan bazy kursantów i lekcji z Notion.
 *
 * Używane zarówno przez CLI tego pliku (zapis do notion_migration_dump.json),
 * jak i bezpośrednio przez scripts/migrate-notion-archive.ts w trybie
 * pobierania na żywo — logika pobierania/parsowania stron Notion żyje
 * wyłącznie tutaj, żeby nie duplikować jej w dwóch miejscach.
 *
 * @param {{ token: string, studentsDbId?: string, lessonsDbId?: string, onProgress?: (msg: string) => void }} options
 */
export async function fetchNotionArchive({
  token,
  studentsDbId = DEFAULT_NOTION_STUDENTS_DB,
  lessonsDbId = DEFAULT_NOTION_LESSONS_DB,
  onProgress = (msg) => console.log(msg),
} = {}) {
  if (!token) {
    throw new Error('fetchNotionArchive: brak tokena Notion (NOTION_API_KEY).');
  }

  onProgress('=== Rozpoczynanie pobierania danych z Notion ===');
  const [studentsPages, lessonPages] = await Promise.all([
    queryDatabase(token, studentsDbId),
    queryDatabase(token, lessonsDbId, {
      or: [
        { property: 'Status', select: { equals: 'Odbyta' } },
        { property: 'Status', select: { equals: 'Podsumowanie' } },
      ],
    }),
  ]);

  onProgress(`Pobrano ${studentsPages.length} kursantów i ${lessonPages.length} lekcji z bazy Notion.`);

  const students = studentsPages.map((p) => ({
    id: p.id,
    name: propText(p, 'Nazwa'),
    emails: propEmails(p, 'Adresy e-mail'),
    level: propText(p, 'Poziom / profil'),
    company: propText(p, 'Gdzie pracuje') || propText(p, 'Firma'),
    isGroup: propText(p, 'Typ') === 'Grupa',
    status: propText(p, 'Status współpracy'),
  }));

  onProgress('Lista kursantów z Notion:');
  students.forEach((s, idx) => {
    onProgress(`  ${idx + 1}. ${s.name} (${s.emails.join(', ') || 'brak email'}) [${s.level || 'brak poziomu'}]`);
  });

  const lessons = [];
  let successCount = 0;
  let failCount = 0;

  onProgress(`\n=== Pobieranie treści ${lessonPages.length} lekcji z Notion (z buforem anty-rate limit) ===`);
  for (let i = 0; i < lessonPages.length; i++) {
    const page = lessonPages[i];
    const topic = propText(page, 'Temat lekcji') || 'Lekcja bez tematu';
    const rawDate = propText(page, 'Data lekcji');
    const studentName = propText(page, 'Kursant');
    const relationIds = propRelationIds(page, 'Kursant (relacja)');

    onProgress(`[${i + 1}/${lessonPages.length}] Pobieram: „${topic.slice(0, 35)}..." (${studentName})...`);
    try {
      const rawText = await pageToText(token, page.id);
      lessons.push({
        id: page.id,
        url: page.url,
        lastEditedTime: page.last_edited_time,
        topic,
        rawDate,
        studentName,
        relationIds,
        rawText,
      });
      successCount++;
    } catch (err) {
      failCount++;
      onProgress(`  -> BŁĄD: ${err.message}`);
    }
  }

  onProgress(`\nZakończono pobieranie treści! Sukces: ${successCount}/${lessonPages.length}, Błędy: ${failCount}`);

  return {
    timestamp: new Date().toISOString(),
    students,
    lessons,
    stats: { totalLessons: lessonPages.length, successCount, failCount },
  };
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const dump = await fetchNotionArchive({ token: process.env.NOTION_API_KEY || '' });
  writeFileSync('scripts/notion_migration_dump.json', JSON.stringify(dump, null, 2));
  console.log('Zapisano zrzut do scripts/notion_migration_dump.json');
}
