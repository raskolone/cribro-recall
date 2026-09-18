import { NOTEBOOK_COLORS } from './notebookPalette';

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

/** Wyciąga najwyższy numer lekcji z nagłówków dokumentu. */
export const highestLessonNumber = (html: string): number => {
  if (!html) return 0;
  // Bierzemy TYLKO nagłówki: „Lesson 12" w treści notatki (np. w cytacie
  // z podręcznika) nie jest numerem zajęć i nie ma prawa przesuwać licznika.
  const headings = html.match(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi) || [];
  let highest = 0;
  for (const heading of headings) {
    const text = heading.replace(/<[^>]+>/g, ' ');
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
 * Wyciąga treść sekcji „Main topic / Practice" i „Key Language &
 * Corrections" z OSTATNIEJ lekcji w dokumencie — surowy tekst (bez
 * znaczników), używany jako materiał wejściowy do wygenerowania sekcji
 * Revision następnej lekcji. `null`, gdy w dokumencie nie ma jeszcze
 * żadnej lekcji (Lesson 1).
 *
 * `fallbackText` to treść CAŁEJ ostatniej lekcji (wszystkie sekcje razem) —
 * używana, gdy lektor nie wypełnił jeszcze konkretnie „Main topic" ani
 * „Key Language", ale coś już jest wpisane gdzie indziej (np. w Homework)
 * i AI ma z czego ułożyć powtórkę, zamiast dostawać puste materiały.
 */
export const extractLastLessonSections = (
  html: string
): { mainTopic: string; keyLanguage: string; fallbackText: string } | null => {
  if (!html) return null;
  const lessons = splitByHeading(html, 'h2').filter(l => /lesson|lekcja/i.test(l.title));
  if (lessons.length === 0) return null;
  const lastLesson = lessons[lessons.length - 1];
  const sections = splitByHeading(lastLesson.body, 'h3');

  const findSection = (matcher: RegExp) => sections.find(s => matcher.test(s.title));

  return {
    mainTopic: stripHtml(findSection(/main topic|practice/i)?.body || ''),
    keyLanguage: stripHtml(findSection(/key language|corrections/i)?.body || ''),
    fallbackText: stripHtml(lastLesson.body),
  };
};

/** Data w formacie używanym w nagłówkach notatnika. */
export const templateDate = (date: Date = new Date()): string =>
  date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Sekcje wpisu lekcyjnego. Kolor niesie ROLĘ sekcji, nie ozdobę: te same pięć
 * barw wraca w każdej lekcji, więc po miesiącu lektor trafia wzrokiem w
 * „Homework" bez czytania nagłówka.
 *
 * ══ DLACZEGO WSZYSTKIE PIĘĆ MA TĘ SAMĄ JASNOŚĆ ══
 *
 * Kolor jest wpisany w HTML dokumentu (`style="color:…"`), więc nie da się
 * go przestawić motywem — ta sama wartość musi działać na jasnym papierze
 * I na ciemnej kartce. Poprzedni zestaw był dobrany wyłącznie pod papier:
 * mocne, ciemne barwy (#d81b7a, #1d4ed8, #7c3aed) na ciemnej kartce robiły
 * się jaskrawymi plamami, a każda z nich innej mocy — pięć nagłówków
 * wyglądało jak pięć niezależnych decyzji.
 *
 * Te pięć ma tę samą jasność względną (około 0,22), czyli około 3,4:1 na
 * papierze i 4,4:1 na ciemnej kartce. Wspólna jasność jest tym, co robi
 * z nich JEDEN zestaw: różnią się wyłącznie odcieniem, bo tylko odcień
 * niesie tu znaczenie.
 *
 * Wpisy zrobione wcześniej zachowują swoje kolory — są zapisane w treści
 * dokumentu i nikt ich nie przepisuje za lektorem.
 */
export const LESSON_SECTIONS: { title: string; color: string }[] = [
  { title: 'Revision', color: NOTEBOOK_COLORS.rose },
  { title: 'Main topic / Practice', color: NOTEBOOK_COLORS.green },
  { title: 'Lesson Summary', color: NOTEBOOK_COLORS.blue },
  { title: 'Key Language &amp; Corrections (New words)', color: NOTEBOOK_COLORS.orange },
  { title: 'Homework', color: NOTEBOOK_COLORS.violet },
];

/**
 * HTML jednego wpisu lekcyjnego. `previousHtml` służy do odczytania
 * numeru poprzedniej lekcji.
 *
 * Każda nowa lekcja zaczyna się na nowej stronie A4 (podział strony `pad-page-break`),
 * a jej główny nagłówek H2 ma automatycznie włączone menu zwijania (toggle).
 */
export const buildLessonTemplate = (options?: {
  previousHtml?: string;
  lessonNumber?: number;
  date?: Date;
  recallItems?: {
    corrections?: string[];
    vocabulary?: string[];
  };
  /**
   * Sekcja Revision wygenerowana przez AI (patrz `generateLessonRevision`
   * w `services/scratchpadAiService.ts`) — gotowy fragment HTML, wstawiany
   * do sekcji Revision zamiast `recallItems`, gdy podany.
   */
  revisionHtml?: string;
}): string => {
  const previous = options?.previousHtml || '';
  const number =
    options?.lessonNumber ?? highestLessonNumber(previous) + 1;
  const date = templateDate(options?.date);

  const sections = LESSON_SECTIONS.map((section) => {
    let innerBody = '<p><br></p>';
    if (section.title === 'Revision' && options?.revisionHtml && options.revisionHtml.trim().length > 0) {
      innerBody = `${options.revisionHtml}<p><br></p>`;
    } else if (section.title === 'Revision' && options?.recallItems) {
      const { corrections, vocabulary } = options.recallItems;
      const hasCorrections = corrections && corrections.length > 0;
      const hasVocab = vocabulary && vocabulary.length > 0;

      if (hasCorrections || hasVocab) {
        let recallHtml = '';
        if (hasCorrections) {
          recallHtml += '<p><strong>🎯 3 elementy do poprawy / zdania z poprzedniej lekcji:</strong></p><ul>';
          corrections.slice(0, 3).forEach((item) => {
            recallHtml += `<li>${item}</li>`;
          });
          recallHtml += '</ul>';
        }
        if (hasVocab) {
          recallHtml += '<p><strong>📝 Sprawdź znajomość słówek z poprzedniej lekcji:</strong></p><ul>';
          vocabulary.slice(0, 5).forEach((item) => {
            recallHtml += `<li><strong>${item}</strong> — ?</li>`;
          });
          recallHtml += '</ul>';
        }
        innerBody = `${recallHtml}<p><br></p>`;
      }
    }

    return `<h3 style="color:${section.color}">${section.title}</h3>${innerBody}`;
  }).join('');

  const hasPreviousContent = previous.trim().length > 0 && previous.replace(/<[^>]+>/g, '').trim().length > 0;
  const pageBreakHtml = hasPreviousContent
    ? `<div class="pad-page-break" data-page-break="1" contenteditable="false"><span class="pad-page-break-badge">── Strona A4 • Nowa Lekcja ──</span></div>`
    : '';

  return `${pageBreakHtml}<h2 data-toggle="1" data-collapsed="0"><span class="pad-toggle" contenteditable="false" title="Zwiń / rozwiń lekcję">▾</span>Lesson ${number} — ${date}</h2>${sections}`;
};

