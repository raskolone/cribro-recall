import { generateTextWithUnifiedFallback } from './geminiService';

/**
 * Format i etykiety dokładnie jak w zleceniu — kursant widzi tę samą
 * strukturę Revision co lektor wstawiający ją ręcznie. Klasy
 * `badge-error`/`badge-success` to te same zakreślacze co przy ręcznym
 * oznaczaniu błędów w treści lekcji (patrz `index.css`).
 */
const REVISION_SYSTEM_PROMPT = `Jesteś metodykiem języka angielskiego. Na podstawie notatek z poprzedniej lekcji przygotuj sekcję powtórkową (Revision) jako czysty fragment HTML, gotowy do wstawienia w edytorze typu contenteditable. Nie używaj markdown, nie owijaj odpowiedzi w blok kodu, nie dodawaj żadnego wstępu, podsumowania ani komentarza — zwróć wyłącznie fragment HTML.

Struktura (zachowaj dokładnie tę kolejność, etykiety i emoji):

<p><strong>🎯 Elementy do poprawy z poprzedniej lekcji:</strong></p>
<ul>
<li><span class="badge-error">błąd z poprzedniej lekcji</span> → <span class="badge-success">poprawna forma</span> – krótkie wyjaśnienie reguły</li>
</ul>
(dokładnie 3 pozycje w tej liście)

<p><strong>📝 Sprawdź znajomość słówek:</strong></p>
<ul>
<li>angielskie słówko — ?</li>
</ul>
(dokładnie 3 słówka angielskie, potem dokładnie 3 słówka polskie — 6 pozycji łącznie)

<p><strong>✍️ Przetłumacz na angielski:</strong></p>
<ol>
<li>zdanie po polsku testujące gramatykę lub słownictwo z lekcji</li>
</ol>
(dokładnie 5 zdań)

Zasady:
- Generuj dokładnie 3 błędy, 3 słówka EN->PL, 3 słówka PL->EN oraz 5 zdań PL->EN.
- Błędy, słówka i zdania muszą wynikać z treści poprzedniej lekcji podanej przez użytkownika, nie z ogólnego zasobu.
- Zwróć wyłącznie sformatowany fragment HTML sekcji Revision, bez dodatkowych komentarzy.`;

const stripCodeFence = (text: string): string =>
  text
    .trim()
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

/**
 * Generuje sekcję Revision na podstawie treści poprzedniej lekcji
 * (sekcje „Main topic / Practice" i „Key Language & Corrections"
 * wyciągnięte z dokumentu notatnika — patrz `extractLastLessonSections`
 * w `utils/lessonTemplate.ts`).
 */
export const generateLessonRevision = async (previousLessonContent: string): Promise<string> => {
  const prompt = `Notatki z poprzedniej lekcji:\n\n${previousLessonContent}`;
  const { text } = await generateTextWithUnifiedFallback(
    prompt,
    REVISION_SYSTEM_PROMPT,
    undefined,
    undefined,
    undefined,
    { taskName: 'Generowanie sekcji Revision (Notatnik)' }
  );
  return stripCodeFence(text);
};
