/**
 * METODA CRIBRO — WYTYCZNE PLANERA LEKCJI JAKO PROMPT.
 *
 * ══ SKĄD TO POCHODZI ══
 *
 * Odwzorowanie skilla „🎯 Skill - Lesson Planner" z Notion (Prompts &
 * Instructions) wraz z obowiązującymi go nadpisaniami z „🎯 Lesson Planner —
 * Master Prompt & System". Źródłem prawdy pozostaje Notion: jeżeli Maciej
 * zmieni tam zasady, TEN plik trzeba zaktualizować — aplikacja nie czyta
 * skilla na żywo, bo scenariusz musi dać się wygenerować także wtedy, gdy
 * Notion jest niedostępny albo integracja wygasła.
 *
 * ══ CO JEST TU ŚWIADOMIE POMINIĘTE ══
 *
 * Krok 3 skilla („zapisz kartę w bazie Historia Lekcji") NIE jest częścią
 * tego promptu. W Recall scenariusz zapisuje `scenarioService`, a do Notion
 * trafia osobną drogą — model ma UŁOŻYĆ lekcję, a nie decydować o zapisie.
 *
 * Pętla uczenia się na bazie „Pytania wykorzystane na lekcjach" też tu nie
 * wchodzi: to zapytanie do Notion, którego aplikacja jeszcze nie robi.
 * Zamiast udawać, że model ma te dane, mówimy mu wprost, że ich nie ma —
 * inaczej zaczyna wymyślać „sprawdzone wzorce", których nikt nie sprawdził.
 */

export interface LessonBrief {
  /** Tryb zajęć — decyduje o kształcie Warm-upu i Practice Enclosure. */
  mode: '1:1' | 'grupa';
  /** Imię kursanta albo nazwa grupy. Bez tego planer nie rusza. */
  audience: string;
  /** Data zajęć (YYYY-MM-DD). */
  date: string;
  /** Poziom CEFR. */
  level: string;
  /** Temat gramatyczny — pusty znaczy „bez sekcji Grammar Review". */
  grammarTopic?: string;
  /** Materiał źródłowy opisany słowami albo wklejony przez lektora. */
  sourceMaterial?: string;
  /** Streszczenie ostatnich lekcji — podstawa Revision Translation. */
  history?: string;
  /** Dodatkowe uwagi lektora. */
  notes?: string;
}

/** Czy brief wystarcza, żeby w ogóle zacząć (Krok 0 skilla). */
export const briefGate = (brief: Partial<LessonBrief>): string[] => {
  const missing: string[] = [];
  if (!brief.mode) missing.push('tryb zajęć (1:1 czy grupa)');
  if (!brief.audience?.trim()) missing.push('kursant albo nazwa grupy');
  if (!brief.date?.trim()) missing.push('data lekcji');
  return missing;
};

const briefBlock = (brief: LessonBrief): string => `
DANE LEKCJI (potwierdzone przez lektora — nie podważaj ich i nie pytaj o nie ponownie):
- Tryb: ${brief.mode === 'grupa' ? 'grupa 2–4 osoby' : 'lekcja 1:1'}
- ${brief.mode === 'grupa' ? 'Grupa' : 'Kursant'}: ${brief.audience}
- Data lekcji: ${brief.date}
- Poziom CEFR: ${brief.level}
- Gramatyka: ${
  brief.grammarTopic?.trim()
    ? `TAK — temat: ${brief.grammarTopic.trim()}. Wstaw sekcję Grammar Review.`
    : 'NIE — pomiń sekcję Grammar Review całkowicie, bez pustego placeholdera.'
}
${brief.sourceMaterial?.trim() ? `\nMATERIAŁ ŹRÓDŁOWY OD LEKTORA:\n${brief.sourceMaterial.trim()}` : ''}
${brief.history?.trim() ? `\nHISTORIA OSTATNICH LEKCJI (podstawa Revision Translation — bierz WYŁĄCZNIE z ostatniej lekcji):\n${brief.history.trim()}` : '\nBRAK HISTORII — to pierwsza lekcja. Zbuduj plan bez odniesień do przeszłości i bez Revision Translation z poprzedniej lekcji.'}
${brief.notes?.trim() ? `\nUWAGI LEKTORA: ${brief.notes.trim()}` : ''}
`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   TEST NATURALNOŚCI — powtarzany przy KAŻDYM zadaniu, nie tylko przy
   generowaniu całości. To jedyna reguła skilla, którą model łamie
   najczęściej, a łamie ją po cichu: pytanie brzmi mądrze i przechodzi.
   ═══════════════════════════════════════════════════════════════════════ */
const NATURALNESS_TEST = `
TEST NATURALNOŚCI PYTAŃ (obowiązkowy, dotyczy WSZYSTKICH pytań w Warm-up i Main Topic):
1. Test dwóch sekund — pytanie musi dać się zrozumieć i zacząć na nie odpowiadać w mniej niż 2 sekundy, bez czytania dwa razy.
2. Jedno pytanie = jedna myśl. Nigdy nie sklejaj dwóch pytań przez „and" albo „or".
3. Język mówiony, nie eseistyczny. Żadnych konstrukcji z pracy zaliczeniowej („What is your opinion regarding the impact of...").
4. Konkret, nie abstrakcja — pytanie zaczepia się o osobiste doświadczenie, konkretną sytuację albo realny wybór.
5. Kontekst samowystarczalny — pytanie nie zakłada wiedzy, której nie ma w Topic and Material / Lead-in.

ZAKAZ SZTUCZNEGO SŁOWNICTWA W WARM-UP: nie używaj słów w rodzaju „headspace", „bandwidth", „leverage", „facilitate", „optimise", jeśli wystarczy prostsze słowo. Nie zadawaj pytań-ankiet typu „How has your week been so far?" ani „Has anything gone surprisingly well this week?" — brzmią jak formularz, nie jak rozmowa. Kursant ma odpowiedzieć HISTORIĄ, nie raportem stanu.

Przed zapisaniem każdego pytania zadaj sobie pytanie: „Czy powiedziałbym to normalnemu człowiekowi na początku lekcji?". Jeśli nie — przepisz albo wyrzuć.

❌ „What is your opinion regarding the impact of remote work on interpersonal relationships?"
✅ „Has working from home made it harder to actually feel close to people you work with?"
❌ „What did you do last weekend and do you think weekends are important?"
✅ „What's one thing you try to do every weekend, no matter how busy you are?"
`.trim();

/** Prompt systemowy wspólny dla wszystkich wywołań planera. */
export const CRIBRO_METHOD_SYSTEM = `
Jesteś asystentem metodycznym pracującym wyłącznie według THE CRIBRO METHOD. Układasz scenariusze 60-minutowych lekcji konwersacyjnych General English — 1:1 albo dla małej grupy (2–4 osoby).

FILOZOFIA SZKIELETU 15-MINUTOWEGO: jeden szkielet, zero decyzji. Temat i słownictwo się zmieniają, struktura zostaje. Jeśli materiał nie mieści się w szkielecie — PRZYTNIJ MATERIAŁ, nigdy nie rozciągaj szkieletu.

JĘZYK: komentarze metodyczne po polsku, cała treść kierowana do kursanta (pytania, słownictwo, zadania, przykłady) po angielsku.

${NATURALNESS_TEST}

CZEGO NIE MASZ: nie masz dostępu do bazy „Pytania wykorzystane na lekcjach" ani do żadnych danych o tym, które pytania sprawdziły się na prawdziwych zajęciach. NIE WOLNO ci twierdzić, że wzorzec „zadziałał wcześniej", ani powoływać się na nieistniejące dane. Opierasz się na profilu kursanta, materiale źródłowym i Teście naturalności.

FILTR SZUMU — przy każdej pokusie dodania czegoś poza szablonem zadaj sobie pytanie: „Mniej znaczy więcej. Z czego rezygnujemy?".
`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   KROK 1 — PROPOZYCJE TEMATU

   Skill mówi: gdy lektor nie podał materiału, zaproponuj 2–3 opcje z baz
   i POCZEKAJ NA WYBÓR. W Recall to jest osobny krok z własnym ekranem,
   bo bez niego planer od razu wypluwał gotową lekcję na temat, którego
   nikt nie wybierał.
   ═══════════════════════════════════════════════════════════════════════ */

export const buildTopicProposalPrompt = (
  brief: LessonBrief,
  variantCount: number,
  teacherSuggestion?: string
): string => `
${briefBlock(brief)}

${teacherSuggestion?.trim() ? `SUGESTIA LEKTORA CO DO TEMATU:\n${teacherSuggestion.trim()}\nPotraktuj ją jako kierunek obowiązujący — warianty mają być różnymi UJĘCIAMI tej sugestii, a nie tematami obok niej.` : 'Lektor nie podał sugestii tematu. Zaproponuj warianty dopasowane do poziomu, historii i tego, co wiadomo o kursancie.'}

ZADANIE: przygotuj DOKŁADNIE ${variantCount} ${variantCount === 1 ? 'wariant' : variantCount < 5 ? 'warianty' : 'wariantów'} tematu tej lekcji. Nic więcej — nie układaj jeszcze scenariusza.

Każdy wariant ma być WYRAŹNIE INNYM kątem, a nie przeformułowaniem tego samego. Jeżeli lektor nie podał materiału źródłowego, opieraj warianty na typach materiałów z zatwierdzonych baz (ESL Brains, Breaking News English, iSLCollective, iteslj.org) — ale NIE zmyślaj konkretnych tytułów artykułów ani linków, których nie znasz. Opisz materiał rodzajowo („krótki artykuł prasowy o…", „nagranie wideo, w którym…").

Zwróć WYŁĄCZNIE poprawny JSON:
{
  "variants": [
    {
      "title": "Temat lekcji — zwięźle, bez daty, maksymalnie 60 znaków",
      "angle": "Jednym zdaniem po polsku: na czym polega ten kąt i czym różni się od pozostałych",
      "material": "Jakiego materiału źródłowego użyjemy — rodzajowo, po polsku",
      "why": "Dlaczego akurat ten temat pasuje do tego kursanta: poziom, historia, zainteresowania. Po polsku, 1–2 zdania",
      "sampleQuestion": "Jedno przykładowe pytanie dyskusyjne PO ANGIELSKU, przechodzące Test naturalności — próbka tonu całej lekcji"
    }
  ]
}
`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   KROK 2 — PEŁNY SCENARIUSZ

   Scenariusz wraca jako JSON z sekcjami, a nie jako jeden blok markdown.
   Powód jest praktyczny: lektor ma móc ZAZNACZYĆ pojedynczy element
   i kazać go przerobić. Jeden wielki tekst nie da się zaznaczyć po
   kawałku — element musi mieć własny identyfikator już w chwili powstania.
   ═══════════════════════════════════════════════════════════════════════ */

export const buildScenarioPrompt = (
  brief: LessonBrief,
  chosenTopic: { title: string; angle?: string; material?: string }
): string => `
${briefBlock(brief)}

WYBRANY TEMAT (zatwierdzony przez lektora — trzymaj się go):
- Tytuł: ${chosenTopic.title}
${chosenTopic.angle ? `- Kąt: ${chosenTopic.angle}` : ''}
${chosenTopic.material ? `- Materiał: ${chosenTopic.material}` : ''}

ZADANIE: ułóż pełny scenariusz 60-minutowej lekcji według struktury Cribro.

STRUKTURA I TWARDE LICZBY (nie wolno ich zmieniać):
1. Revision and Warm Up (5–10 min)
   - DOKŁADNIE 5 pytań check-in. ${brief.mode === 'grupa' ? 'Dla grupy: wspólne pytania, pierwsze działa jak icebreaker, reszta jako zapas.' : 'Spersonalizowane pod tego kursanta na podstawie historii.'}
   - Revision Translation: 3–5 zdań PL→EN WYŁĄCZNIE z poprzedniej lekcji, razem z kluczem odpowiedzi.
   - Older Lesson Refresh: 1 pytanie albo słówko z wcześniejszej historii.
${brief.grammarTopic?.trim() ? `2. Grammar Review (5–10 min) — temat: ${brief.grammarTopic.trim()}. Krótkie wyjaśnienie (3–4 zdania po polsku, przykłady po angielsku), 3–4 zdania przykładowe, jeden blok szybkiej praktyki ustnej.` : ''}
${brief.grammarTopic?.trim() ? '3' : '2'}. Main Topic (${brief.grammarTopic?.trim() ? '20–25' : '20–30'} min)
   - Topic and Material: wprowadzenie 2–3 zdania PO ANGIELSKU, do przeczytania kursantowi wprost. Bez polskich komentarzy metodycznych w tym miejscu.
   - Lead-in: krótkie wprowadzenie po angielsku.
   - DOKŁADNIE 10 otwartych pytań dyskusyjnych. Każde z własnymi Teacher's Notes.
   - Bank ma być RÓŻNORODNY: osobiste doświadczenie, konkretna sytuacja, realny wybór, rozwiązywanie problemu, scenariusz przyszły lub hipotetyczny. Bez powtórzeń i sztucznej złożoności.
${brief.grammarTopic?.trim() ? '4' : '3'}. Language Focus (10 min)
   - Delayed Correction: 3–5 typowych błędów powiązanych z tematem (błędna wersja → poprawna).
   - Key Vocabulary: DOKŁADNIE 5 pozycji, priorytet dla słownictwa obecnego w materiale źródłowym.
${brief.grammarTopic?.trim() ? '5' : '4'}. Practice Enclosure — ZOSTAW PUSTE. Nie generuj role-play, pracy w parach, mini-debaty, gap-fillu ani żadnego innego ćwiczenia. Taka jest obowiązująca decyzja lektora.
${brief.grammarTopic?.trim() ? '6' : '5'}. Extra Tasks — DOKŁADNIE 4 różne zadania oparte na dzisiejszej lekcji:
   - Task 1 — Translation PL→EN: dokładnie 4 naturalne zdania po polsku do przetłumaczenia.
   - Task 2 — Correct the Mistake: dokładnie 4 zdania po angielsku, każde z JEDNYM wyraźnym, zamierzonym błędem z dzisiejszej lekcji. Bez pytań-pułapek i dwuznacznych poprawek.
   - Task 3 — Finish the Response: dokładnie 4 krótkie, realistyczne sytuacje albo mini-dialogi do dokończenia naturalną odpowiedzią.
   - Task 4 — Build a Natural Sentence: dokładnie 4 zestawy po 2–3 elementy (fraza docelowa, sytuacja, wskazówka gramatyczna) do połączenia w jedno naturalne zdanie. To NIE jest układanka z kolejności słów — nie podawaj słów w kolejności oczekiwanego zdania.
   - Cztery zadania mają się od siebie RÓŻNIĆ. Nie sprawdzaj czterokrotnie tego samego zdania ani tej samej konstrukcji.
   - Nie generuj gap-fillu ani Word Banku.

Teacher's Notes przy każdym pytaniu Main Topic mają 2–4 krótkie, użyteczne elementy: CEL rozmowy, JEDNO naturalne pytanie pogłębiające, oraz wsparcie językowe albo gałąź „jeśli odpowiedź będzie krótka". Czwarty element dodaj tylko wtedy, gdy realnie pomaga. Nie rób z nich drugiego scenariusza lekcji.

Zwróć WYŁĄCZNIE poprawny JSON o strukturze:
{
  "title": "Temat lekcji, bez daty",
  "summary": "2–3 zdania po polsku dla lektora: o czym jest ta lekcja i czego dotyczy jej oś",
  "sections": [
    {
      "id": "warmup",
      "title": "1. Revision and Warm Up (5–10 min)",
      "minutes": "5–10 min",
      "items": [
        {
          "id": "warmup-q1",
          "kind": "question",
          "text": "Treść pytania PO ANGIELSKU",
          "notes": "Teacher's Notes po polsku — pusty string, jeśli niepotrzebne"
        }
      ]
    }
  ]
}

Dozwolone wartości "kind": "question" (pytanie do kursanta), "text" (blok tekstu, np. Topic and Material albo Lead-in), "vocab" (pozycja słownictwa w formacie "english - polski"), "correction" (błąd → poprawna wersja), "task" (treść zadania), "answerKey" (klucz odpowiedzi do zadania bezpośrednio nad nim), "note" (komentarz metodyczny dla lektora).

Każdy element MUSI mieć własne, unikalne "id" złożone z małych liter, cyfr i myślników. Identyfikatory służą lektorowi do zaznaczania pojedynczych elementów i proszenia o ich poprawkę — muszą być stabilne i opisowe (np. "main-q7", "vocab-3", "task2-s4").

Sekcja Practice Enclosure ma mieć pustą tablicę "items".
`.trim();

/* ═══════════════════════════════════════════════════════════════════════
   KROK 3 — POPRAWKA ZAZNACZONYCH ELEMENTÓW

   Model dostaje CAŁY scenariusz jako kontekst, ale wolno mu zmienić
   WYŁĄCZNIE zaznaczone elementy. Bez tego ograniczenia każda prośba
   o poprawienie jednego pytania wracała jako przepisana cała lekcja —
   i lektor tracił wszystko, co wcześniej zaakceptował.
   ═══════════════════════════════════════════════════════════════════════ */

export const buildRevisionPrompt = (
  brief: LessonBrief,
  scenarioJson: string,
  selectedIds: string[],
  instruction: string
): string => `
${briefBlock(brief)}

AKTUALNY SCENARIUSZ (pełny kontekst — po to, żebyś wiedział, w co wpisujesz poprawkę):
${scenarioJson}

ELEMENTY ZAZNACZONE PRZEZ LEKTORA DO ZMIANY (identyfikatory):
${selectedIds.map(id => `- ${id}`).join('\n')}

POLECENIE LEKTORA:
${instruction.trim()}

TWARDE OGRANICZENIE: wolno ci zmienić WYŁĄCZNIE elementy o wymienionych wyżej identyfikatorach. Nie ruszaj żadnego innego elementu, nie dodawaj nowych, nie usuwaj istniejących i nie zmieniaj identyfikatorów. Liczba pytań w każdej sekcji ma zostać taka sama.

Każdy poprawiony element nadal musi przejść Test naturalności i trzymać się poziomu ${brief.level}.

Zwróć WYŁĄCZNIE poprawny JSON zawierający TYLKO zmienione elementy:
{
  "updates": [
    { "id": "identyfikator", "text": "nowa treść", "notes": "nowe Teacher's Notes albo pusty string" }
  ],
  "comment": "Jedno–dwa zdania po polsku: co zmieniłeś i dlaczego"
}
`.trim();
