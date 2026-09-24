import { NOTEBOOK_INK } from './notebookPalette';

/**
 * Kolor obramowania pod tytułem lekcji (H2) i drugorzędny, przytłumiony
 * kolor tekstu sekcji (H3) — jeden neutralny odcień na motyw papieru,
 * zamiast pięciu jaskrawych barw. Patrz komentarz przy `LESSON_SECTIONS`.
 */
export const TEMPLATE_TONE = {
  light: { border: '#e2e8f0', sectionText: '#475569' },
  dark: { border: 'rgba(255,255,255,0.14)', sectionText: '#94a3b8' },
} as const;

/** Inline `style` dla nagłówka H2 tytułu lekcji ("Lesson N — data"). */
export const lessonTitleStyle = (paperTheme: 'light' | 'dark' = 'light'): string =>
  `font-size:22px;font-weight:750;color:#0f172a;border-bottom:2px solid rgba(13, 138, 95, 0.4);padding-bottom:6px;margin-top:8px;margin-bottom:18px;letter-spacing:-0.01em;`;

/**
 * Inline `style` dla nagłówka H3 sekcji lekcji (QUICK RECALL, TODAY'S LESSON itd.).
 * Używa semantycznych barw o wysokim kontraście na jasnym papierze:
 * - Quick Recall: morski akcent (#0f766e)
 * - Today's Lesson: główny szmaragd (#0d8a5f)
 * - Language Notes: dyskretny indygo lektora (#4338ca)
 * - After the Lesson: ciepły bursztyn (#b45309)
 */
export const sectionHeadingStyle = (titleOrTheme?: string, fallbackTheme?: 'light' | 'dark'): string => {
  const isTheme = titleOrTheme === 'light' || titleOrTheme === 'dark';
  const theme = isTheme ? titleOrTheme : fallbackTheme || 'light';
  const title = !isTheme ? (titleOrTheme || '') : '';
  const titleUpper = title.toUpperCase();

  let color = theme === 'dark' ? '#72f0b4' : '#0d8a5f';
  if (titleUpper.includes('QUICK RECALL') || titleUpper.includes('WARM')) {
    color = '#0f766e';
  } else if (titleUpper.includes('LANGUAGE') || titleUpper.includes('NOTES') || titleUpper.includes('GRAMMAR')) {
    color = '#4338ca';
  } else if (titleUpper.includes('AFTER') || titleUpper.includes('HOMEWORK')) {
    color = '#b45309';
  } else if (titleUpper.includes('TODAY')) {
    color = '#0d8a5f';
  }

  return `font-size:15px;font-weight:750;text-transform:uppercase;letter-spacing:0.06em;color:${color};margin-top:22px;margin-bottom:10px;`;
};

/**
 * Szablon wpisu lekcyjnego w notatniku.
 *
 * ══ DLACZEGO NUMER LEKCJI LICZY SIĘ Z DOKUMENTU ══
 *
 * Notatnik kursanta jest jeden i rośnie przez cały kurs — lekcja po lekcji,
 * od góry do dołu. Numer kolejnych zajęć jest więc już w dokumencie: wystarczy
 * spojrzeć, jaki najwyższy numer pada w dotychczasowych nagłówkach. Trzymanie
 * osobnego licznika w bazie znaczyłoby drugą prawdę o tym samym — i pierwszą
 * okazję do rozjechania się, gdy lektor poprawi numer ręcznie.
 *
 * Numer jest zwykłym tekstem w nagłówku, więc poprawienie go palcem działa
 * i jest brane pod uwagę przy następnym wstawieniu.
 */

/** Wyciąga najwyższy numer lekcji z nagłówków dokumentu (pomija wpisy typu szablon / draft). */
export const highestLessonNumber = (html: string): number => {
  if (!html) return 0;
  // Bierzemy TYLKO nagłówki: „Lesson 12" w treści notatki nie jest numerem zajęć
  const headings = html.match(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi) || [];
  let highest = 0;
  for (const heading of headings) {
    const text = heading.replace(/<[^>]+>/g, ' ');
    // Ignoruj nagłówki szablonów technicznych
    if (/szablon|template|draft template/i.test(text)) continue;
    const match = text.match(/(?:lesson|lekcja)\s*(?:nr\.?\s*)?#?\s*(\d{1,4})/i);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
};

const stripHtml = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Dzieli fragment HTML na sekcje po nagłówkach danego poziomu. */
const splitByHeading = (
  html: string,
  tag: 'h2' | 'h3'
): { title: string; body: string }[] => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const headings: { title: string; index: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    headings.push({ title: stripHtml(match[1]), index: match.index, end: regex.lastIndex });
  }
  return headings.map((heading, i) => ({
    title: heading.title,
    body: html.slice(heading.end, i + 1 < headings.length ? headings[i + 1].index : html.length),
  }));
};

/**
 * Wyciąga treść sekcji z OSTATNIEJ lekcji w dokumencie — surowy tekst (bez
 * znaczników), używany jako materiał wejściowy do wygenerowania Quick Recall.
 */
export const extractLastLessonSections = (
  html: string
): { mainTopic: string; keyLanguage: string; fallbackText: string } | null => {
  if (!html) return null;
  const lessons = splitByHeading(html, 'h2').filter(l => /lesson|lekcja/i.test(l.title) && !/szablon|template/i.test(l.title));
  if (lessons.length === 0) return null;
  const lastLesson = lessons[lessons.length - 1];
  const sections = splitByHeading(lastLesson.body, 'h3');

  const findSection = (matcher: RegExp) => sections.find(s => matcher.test(s.title));

  return {
    mainTopic: stripHtml(findSection(/today|main topic|practice/i)?.body || ''),
    keyLanguage: stripHtml(findSection(/language notes|key language|corrections/i)?.body || ''),
    fallbackText: stripHtml(lastLesson.body),
  };
};

/** Data w formacie używanym w nagłówkach notatnika. */
export const templateDate = (date: Date = new Date()): string =>
  date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Domyślne sekcje wpisu lekcyjnego zgodne ze standardem CRIBRO.
 */
export const LESSON_SECTIONS: { title: string; defaultContent: string }[] = [
  {
    title: 'QUICK RECALL',
    defaultContent: '<p><br></p>',
  },
  {
    title: 'TODAY’S LESSON',
    defaultContent: '<p><br></p>',
  },
  {
    title: 'LANGUAGE NOTES',
    defaultContent: '<p><br></p>',
  },
  {
    title: 'AFTER THE LESSON',
    defaultContent: '<p><br></p>',
  },
];

/**
 * HTML jednego wpisu lekcyjnego.
 * Tytuł: `Lesson [numer] — [temat]` lub `Lesson [numer] — [data]`.
 * Sekcje: QUICK RECALL, TODAY’S LESSON, LANGUAGE NOTES, AFTER THE LESSON.
 */
export const buildLessonTemplate = (options?: {
  previousHtml?: string;
  lessonNumber?: number;
  topic?: string;
  date?: Date | string;
  recallItems?: {
    corrections?: string[];
    vocabulary?: string[];
  };
  /** Wygenerowany fragment HTML dla sekcji Quick Recall. */
  revisionHtml?: string;
  /** Motyw papieru kursanta w chwili wstawienia. */
  paperTheme?: 'light' | 'dark';
  /** Czy wstawić czysty, pusty szablon bez domyślnych tekstów pomocniczych */
  cleanEmpty?: boolean;
}): string => {
  const previous = options?.previousHtml || '';
  const number =
    options?.lessonNumber ?? highestLessonNumber(previous) + 1;
  const dateStr =
    typeof options?.date === 'string'
      ? options.date
      : templateDate(options?.date instanceof Date ? options.date : undefined);
  const paperTheme = options?.paperTheme || 'light';

  const cleanTopic = options?.topic?.trim();
  const headerSuffix = cleanTopic && cleanTopic.length > 0 ? cleanTopic : dateStr;
  const titleText = `Lesson ${number} — ${headerSuffix}`;

  const sections = LESSON_SECTIONS.map((section) => {
    let innerBody = section.defaultContent;

    if (section.title === 'QUICK RECALL') {
      if (options?.revisionHtml && options.revisionHtml.trim().length > 0) {
        innerBody = options.revisionHtml;
      } else if (options?.recallItems && !options?.cleanEmpty) {
        const { corrections, vocabulary } = options.recallItems;
        const hasCorrections = corrections && corrections.length > 0;
        const hasVocab = vocabulary && vocabulary.length > 0;

        if (hasCorrections || hasVocab) {
          let recallHtml = '';
          if (hasCorrections) {
            recallHtml += '<p><strong>🎯 Corrections to revisit:</strong></p><ul>';
            corrections.slice(0, 3).forEach((item) => {
              recallHtml += `<li>${item}</li>`;
            });
            recallHtml += '</ul>';
          }
          if (hasVocab) {
            recallHtml += '<p><strong>📝 Words &amp; phrases:</strong></p><ul>';
            vocabulary.slice(0, 5).forEach((item) => {
              recallHtml += `<li><strong>${item}</strong></li>`;
            });
            recallHtml += '</ul>';
          }
          innerBody = recallHtml;
        }
      }
    }

    return `<h3 contenteditable="false" class="pad-locked-heading" style="${sectionHeadingStyle(section.title, paperTheme)}">${section.title}</h3>${innerBody}`;
  }).join('');

  const hasPreviousContent = previous.trim().length > 0 && previous.replace(/<[^>]+>/g, '').trim().length > 0;
  const pageBreakHtml = hasPreviousContent
    ? `<div class="pad-page-break" data-page-break="1" contenteditable="false"><span class="pad-page-break-badge">── Strona A4 • Nowa Lekcja ──</span></div>`
    : '';

  return `${pageBreakHtml}<h2 data-toggle="1" data-collapsed="0" contenteditable="false" class="pad-locked-heading" style="${lessonTitleStyle(paperTheme)}"><span class="pad-toggle" contenteditable="false" title="Zwiń / rozwiń lekcję">▾</span>${titleText}</h2>${sections}`;
};

