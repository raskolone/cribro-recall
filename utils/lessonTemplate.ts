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

/** Data w formacie używanym w nagłówkach notatnika. */
export const templateDate = (date: Date = new Date()): string =>
  date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Sekcje wpisu lekcyjnego. Kolor niesie ROLĘ sekcji, nie ozdobę: te same pięć
 * barw wraca w każdej lekcji, więc po miesiącu lektor trafia wzrokiem w
 * „Homework" bez czytania nagłówka.
 */
export const LESSON_SECTIONS: { title: string; color: string }[] = [
  { title: 'Revision', color: '#d81b7a' },
  { title: 'Main topic / Practice', color: '#0e8f83' },
  { title: 'Lesson Summary', color: '#1d4ed8' },
  { title: 'Key Language &amp; Corrections (New words)', color: '#c2321f' },
  { title: 'Homework', color: '#7c3aed' },
];

/**
 * HTML jednego wpisu lekcyjnego. `previousHtml` służy wyłącznie do odczytania
 * numeru poprzedniej lekcji — nic z niego nie jest kopiowane.
 */
export const buildLessonTemplate = (options?: {
  previousHtml?: string;
  lessonNumber?: number;
  date?: Date;
}): string => {
  const number =
    options?.lessonNumber ?? highestLessonNumber(options?.previousHtml || '') + 1;
  const date = templateDate(options?.date);

  const sections = LESSON_SECTIONS.map(
    section =>
      `<h3 style="color:${section.color}">${section.title}</h3><p><br></p>`
  ).join('');

  return `<h2>Lesson ${number} — ${date}</h2>${sections}`;
};
