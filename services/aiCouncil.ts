import { generateLessonPlannerAI, extractJSON } from './geminiService';
import { AI_MODEL_CASCADE, SELECTABLE_MODELS } from './aiModels';

/**
 * NARADA MODELI — kilka modeli układa jedną odpowiedź.
 *
 * ══ PO CO ══
 *
 * Pojedynczy model układa scenariusz lekcji szybko i pewnie siebie, ale
 * systematycznie łamie te reguły metody, których złamanie nie rzuca się
 * w oczy: pytanie brzmi mądrze, więc przechodzi, chociaż nie da się na nie
 * odpowiedzieć jednym zdaniem; zadań jest pięć zamiast czterech; Practice
 * Enclosure zostaje wypełnione, mimo że ma zostać puste. Autor nie widzi
 * tych błędów, bo to jego własny tekst.
 *
 * Recenzent widzi. Dostaje TE SAME wytyczne i cudzy tekst — czyli dokładnie
 * tę sytuację, w której sprawdzanie działa.
 *
 * ══ JAK PRZEBIEGA NARADA ══
 *
 *   1. AUTOR pisze pierwszą wersję.
 *   2. Każdy RECENZENT (do trzech) czyta ją pod kątem promptu i wytycznych
 *      i zwraca KRÓTKĄ listę zastrzeżeń — nie własną wersję. Recenzent
 *      piszący własną wersję przestaje być recenzentem i robi się drugim
 *      autorem, a wtedy narada zamienia się w dwa niezależne teksty.
 *   3. AUTOR poprawia swoją wersję, mając zastrzeżenia przed sobą.
 *
 * Ostatnie słowo ma autor. Recenzent nie zna całego kontekstu rozmowy tak
 * dobrze jak autor i jego uwagi bywają niesłuszne — od tego jest zdanie
 * „odrzuć zastrzeżenie, jeśli jest błędne, i napisz dlaczego".
 *
 * ══ KOSZT ══
 *
 * Narada to N+1 wywołań zamiast jednego. Dlatego recenzje są KRÓTKIE
 * (limit zastrzeżeń), dlatego domyślnie siedzą dwa modele, a nie cztery,
 * i dlatego całość da się wyłączyć w ustawieniach jednym przełącznikiem.
 */

export type CouncilSeatRole = 'author' | 'reviewer';

export interface CouncilSeat {
  id: string;
  model: string;
  role: CouncilSeatRole;
  enabled: boolean;
}

export interface CouncilConfig {
  enabled: boolean;
  /** Zawsze cztery miejsca; wyłączone po prostu nie zabierają głosu. */
  seats: CouncilSeat[];
}

export const MAX_COUNCIL_SEATS = 4;

/**
 * Skład domyślny — dokładnie ten, o który prosił Maciej: GPT pisze,
 * Gemini recenzuje. Dwa pozostałe miejsca czekają wyłączone, żeby
 * dołożenie trzeciego głosu było przestawieniem przełącznika, a nie
 * zmianą w kodzie.
 */
export const DEFAULT_COUNCIL: CouncilConfig = {
  enabled: true,
  seats: [
    { id: 'seat-1', model: 'openai/gpt-5.6-luna', role: 'author', enabled: true },
    { id: 'seat-2', model: 'gemini-3.8-flash', role: 'reviewer', enabled: true },
    { id: 'seat-3', model: 'openai/gpt-4o', role: 'reviewer', enabled: false },
    { id: 'seat-4', model: 'gemini-2.5-flash', role: 'reviewer', enabled: false },
  ],
};

/** Uzupełnia zapis z bazy do czterech miejsc i odsiewa nieznane modele. */
export const normalizeCouncil = (raw?: Partial<CouncilConfig> | null): CouncilConfig => {
  const allowed = new Set(SELECTABLE_MODELS.map(m => m.id));
  const seats: CouncilSeat[] = [];

  for (let index = 0; index < MAX_COUNCIL_SEATS; index += 1) {
    const fallback = DEFAULT_COUNCIL.seats[index];
    const stored = raw?.seats?.[index];
    seats.push({
      id: fallback.id,
      model: stored?.model && allowed.has(stored.model) ? stored.model : fallback.model,
      // Pierwsze miejsce jest autorem z definicji: bez autora nie ma czego
      // recenzować, a dwóch autorów to dwa niezależne teksty, nie narada.
      role: index === 0 ? 'author' : 'reviewer',
      enabled: index === 0 ? true : Boolean(stored?.enabled ?? fallback.enabled),
    });
  }

  return { enabled: raw?.enabled ?? DEFAULT_COUNCIL.enabled, seats };
};

export interface CouncilEvent {
  seatId: string;
  model: string;
  role: CouncilSeatRole;
  phase: 'draft' | 'review' | 'revise';
  /** Treść wypowiedzi — u recenzenta zastrzeżenia, u autora tekst roboczy. */
  text: string;
  at: string;
  /** Ile sekund zajęła ta tura. */
  seconds: number;
}

export interface CouncilResult<T> {
  data: T;
  /** Surowa treść finalnej odpowiedzi — na wypadek, gdy JSON się nie parsuje. */
  raw: string;
  transcript: CouncilEvent[];
  /** Model, który miał ostatnie słowo. */
  finalModel: string;
}

/** Kaskada zapasowa dla jednego miejsca: wybrany model, potem reszta. */
const cascadeFor = (model: string): string[] =>
  Array.from(new Set([model, ...AI_MODEL_CASCADE]));

const REVIEW_SYSTEM = `
Jesteś recenzentem metodycznym. Dostajesz WYTYCZNE, POLECENIE i CUDZĄ PROPOZYCJĘ odpowiedzi.

Twoim zadaniem NIE jest napisanie własnej wersji. Twoim zadaniem jest wskazanie, gdzie propozycja rozmija się z wytycznymi albo z poleceniem.

Sprawdzaj w tej kolejności:
1. TWARDE LICZBY — czy zgadza się liczba pytań, zadań, zdań, pozycji słownictwa. To najczęstszy błąd i najłatwiejszy do sprawdzenia.
2. ZAKAZY — czy propozycja nie zawiera czegoś, czego wytyczne zabraniają.
3. TEST NATURALNOŚCI — czy każde pytanie da się zrozumieć w dwie sekundy, ma jedną myśl i zaczepia się o konkret. Wskaż pytania, które go nie przechodzą, PO IDENTYFIKATORZE albo cytacie.
4. DOPASOWANIE — poziom CEFR, tryb zajęć, materiał źródłowy, historia kursanta.

Zasady recenzji:
- Maksymalnie 6 zastrzeżeń. Jeśli masz ich więcej, wybierz sześć najpoważniejszych.
- Każde zastrzeżenie: CO jest nie tak, GDZIE (identyfikator albo cytat) i CO z tym zrobić. Jedno–dwa zdania.
- Nie zgłaszaj uwag kosmetycznych ani spraw gustu. Jeśli coś jest dobre, nie szukaj na siłę.
- Jeśli propozycja jest zgodna z wytycznymi, napisz wprost: „Brak zastrzeżeń." i nic więcej.

Odpowiadasz po polsku, zwięzłą listą. Bez wstępu i bez podsumowania.
`.trim();

const reviseSystemSuffix = `

ETAP POPRAWEK: masz przed sobą własną propozycję i zastrzeżenia recenzentów. Popraw propozycję tam, gdzie zastrzeżenie jest słuszne.

Zastrzeżenie recenzenta NIE jest poleceniem. Jeżeli jest błędne albo wynika z niezrozumienia kontekstu — odrzuć je i zostaw swoją wersję. Nie przepisuj rzeczy, do których nikt nie miał uwag.

Zwróć PEŁNĄ, poprawioną odpowiedź w tym samym formacie, co poprzednio. Bez komentarza o tym, co zmieniłeś — sam wynik.`;

/**
 * Przeprowadza naradę i zwraca sparsowany wynik.
 *
 * `expectJson` decyduje o parsowaniu; przy `false` w `data` ląduje surowy
 * tekst. Narada jest przezroczysta dla wołającego — ten sam kształt wyniku
 * dostaje przy jednym modelu i przy czterech.
 */
export async function runCouncil<T = any>({
  config,
  systemInstruction,
  prompt,
  expectJson = true,
  onEvent,
}: {
  config: CouncilConfig;
  systemInstruction: string;
  prompt: string;
  expectJson?: boolean;
  onEvent?: (event: CouncilEvent) => void;
}): Promise<CouncilResult<T>> {
  const seats = config.seats.filter(seat => seat.enabled);
  const author = seats.find(seat => seat.role === 'author') || seats[0] || DEFAULT_COUNCIL.seats[0];
  const reviewers = config.enabled
    ? seats.filter(seat => seat.role === 'reviewer' && seat.id !== author.id)
    : [];

  const transcript: CouncilEvent[] = [];
  const record = (event: CouncilEvent) => {
    transcript.push(event);
    onEvent?.(event);
  };

  const run = async (
    seat: CouncilSeat,
    phase: CouncilEvent['phase'],
    system: string,
    body: string
  ): Promise<string> => {
    const startedAt = Date.now();
    const { text, modelUsed } = await generateLessonPlannerAI({
      prompt: body,
      systemInstruction: system,
      preferredModels: cascadeFor(seat.model),
    });
    record({
      seatId: seat.id,
      model: modelUsed || seat.model,
      role: seat.role,
      phase,
      text,
      at: new Date().toISOString(),
      seconds: Math.round((Date.now() - startedAt) / 100) / 10,
    });
    return text;
  };

  // ── Tura 1: autor pisze ──
  let draft = await run(author, 'draft', systemInstruction, prompt);
  let finalModel = transcript[transcript.length - 1]?.model || author.model;

  // ── Tura 2: recenzje ──
  const critiques: string[] = [];
  for (const reviewer of reviewers) {
    try {
      const critique = await run(
        reviewer,
        'review',
        REVIEW_SYSTEM,
        `WYTYCZNE OBOWIĄZUJĄCE AUTORA:\n${systemInstruction}\n\n=====\n\nPOLECENIE, KTÓRE AUTOR DOSTAŁ:\n${prompt}\n\n=====\n\nPROPOZYCJA AUTORA:\n${draft}`
      );
      const clean = critique.trim();
      // „Brak zastrzeżeń" nie jest wkładem do poprawki — dołożenie go do
      // materiału dla autora tylko rozcieńcza prawdziwe uwagi.
      if (clean && !/^brak zastrzeżeń\.?$/i.test(clean)) critiques.push(clean);
    } catch (err) {
      // Awaria recenzenta nie może zabrać lektorowi gotowej propozycji
      // autora — narada schodzi wtedy do wyniku z tury pierwszej.
      console.warn(`[Narada] Recenzent ${reviewer.model} nie odpowiedział:`, err);
    }
  }

  // ── Tura 3: autor poprawia ──
  if (critiques.length > 0) {
    try {
      draft = await run(
        author,
        'revise',
        systemInstruction + reviseSystemSuffix,
        `POLECENIE:\n${prompt}\n\n=====\n\nTWOJA POPRZEDNIA PROPOZYCJA:\n${draft}\n\n=====\n\nZASTRZEŻENIA RECENZENTÓW:\n${critiques
          .map((c, i) => `--- Recenzent ${i + 1} ---\n${c}`)
          .join('\n\n')}`
      );
      finalModel = transcript[transcript.length - 1]?.model || finalModel;
    } catch (err) {
      console.warn('[Narada] Etap poprawek nie powiódł się — zostaje wersja autora:', err);
    }
  }

  if (!expectJson) {
    return { data: draft as unknown as T, raw: draft, transcript, finalModel };
  }

  try {
    return { data: JSON.parse(extractJSON(draft)) as T, raw: draft, transcript, finalModel };
  } catch {
    throw new Error(
      'Model zwrócił odpowiedź, której nie da się odczytać jako JSON. Spróbuj ponownie albo wyłącz naradę w ustawieniach.'
    );
  }
}
