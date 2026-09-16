import { generateLessonPlannerAI, extractJSON } from './geminiService';
import { AI_MODEL_CASCADE, SELECTABLE_MODELS } from './aiModels';

/**
 * NARADA MODELI — kilka modeli układa jedną odpowiedź.
 *
 * ══ JAK PRZEBIEGA NARADA ══
 *   1. AUTOR (np. Gemini 3.8 Flash / OpenAI) generuje wstępny draft odpowiedzi / ćwiczeń.
 *   2. RECENZENCI (Gemini 2.5 Flash, GPT-4o mini, Claude) analizują propozycję pod kątem:
 *      - Twardych liczb (ilość zdań, pytań, opcji),
 *      - Testu naturalności (eliminacja sztucznych, bezsensownych zdań np. "The invoice drinks the deadline"),
 *      - Zgodności z poziomem CEFR, Learning Curve i profilem kursanta.
 *   3. AUTOR nanosi poprawki uwzględniając słuszne uwagi recenzentów i zwraca ostateczny wynik.
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
 * Domyślny skład narady — zgodnie z wytycznymi użytkownika:
 * Autor: Gemini 3.8 Flash (Najnowszy Flash),
 * Recenzent 1: Gemini 2.5 Flash (Domyślny),
 * Recenzent 2: GPT-4o mini (Lekki),
 * Recenzent 3: GPT-4o (Opcjonalny).
 */
export const DEFAULT_COUNCIL: CouncilConfig = {
  enabled: true,
  seats: [
    { id: 'seat-1', model: 'gemini-3.8-flash', role: 'author', enabled: true },
    { id: 'seat-2', model: 'gemini-2.5-flash', role: 'reviewer', enabled: true },
    { id: 'seat-3', model: 'openai/gpt-4o-mini', role: 'reviewer', enabled: true },
    { id: 'seat-4', model: 'openai/gpt-4o', role: 'reviewer', enabled: false },
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
  text: string;
  at: string;
  seconds: number;
}

export interface CouncilResult<T> {
  data: T;
  raw: string;
  transcript: CouncilEvent[];
  finalModel: string;
}

const cascadeFor = (model: string): string[] =>
  Array.from(new Set([model, ...AI_MODEL_CASCADE]));

export const DEFAULT_REVIEW_SYSTEM = `
Jesteś recenzentem metodycznym. Dostajesz WYTYCZNE, POLECENIE i CUDZĄ PROPOZYCJĘ odpowiedzi.

Twoim zadaniem NIE jest napisanie własnej wersji. Twoim zadaniem jest wskazanie, gdzie propozycja rozmija się z wytycznymi albo z poleceniem.

Sprawdzaj w tej kolejności:
1. TWARDE LICZBY — czy zgadza się liczba pytań, zadań, zdań, pozycji słownictwa.
2. SENS I WIARYGODNOŚĆ ZDAŃ — czy zdania opisują realne, sensowne sytuacje życiowe/biznesowe (BEZWZGLĘDNY ZAKAZ bezsensownych zlepków słów czy zdań-wydmuszek).
3. TEST NATURALNOŚCI — czy każde zdanie po angielsku i po polsku brzmi naturalnie dla rodzimego użytkownika języka.
4. DOPASOWANIE DO KURSANTA — poziom CEFR, historia błędów, Learning Curve.

Zasady recenzji:
- Maksymalnie 6 konkretnych zastrzeżeń.
- Każde zastrzeżenie: CO jest nie tak, GDZIE (cytat lub nr) i JAK to poprawić.
- Jeśli propozycja jest poprawna i naturalna, napisz wyłącznie: „Brak zastrzeżeń."

Odpowiadasz po polsku, zwięzłą listą punktowaną bez zbędnych wstępów.
`.trim();

export const EXERCISE_REVIEW_SYSTEM = `
Jesteś rygorystycznym recenzentem ćwiczeń językowych ESL.
Twoim celem jest wyeliminowanie nielogicznych, sztucznych i dziwacznych zdań.

Kryteria weryfikacji:
1. SENS ZDANIA: Czy podmiot, czasownik i dopełnienie tworzą logiczną całość w realnym świecie? Odrzuć zdania, które brzmią jak wygenerowane losowo.
2. JEDNOZNACZNOŚĆ: Czy w ćwiczeniach typu "Ułóż zdanie" lub "Wybór wielokrotny" istnieje DOKŁADNIE JEDNA poprawna odpowiedź?
3. POLSZCZYZNA: Czy polskie tłumaczenia/wskazówki brzmią naturalnie, a nie jak dosłowny translator?
4. POZIOM I PROFIL: Czy poziom trudności i kontekst odpowiada profilowi kursanta?

Zgłoś maksymalnie 5 najważniejszych uwag z cytatem błędnego fragmentu i sugestią poprawy. Jeśli wszystko jest bez zarzutu: „Brak zastrzeżeń."
`.trim();

export const WARMUP_REVIEW_SYSTEM = `
Jesteś recenzentem rozgrzewek konwersacyjnych (Warm-up & Wheel of Fortune).
Sprawdź, czy zaproponowane pytania:
1. Prowokują do naturalnej, płynnej wypowiedzi (60-90 sekund),
2. Są ciekawe, dojrzałe i adekwatne do dorosłego kursanta (brak infantylnych pytań),
3. Nie zawierają nielogicznych konstrukcji gramatycznych ani mylących podpowiedzi.

Wypisz zwięźle uwagi lub napisz „Brak zastrzeżeń."
`.trim();

export const SCRATCHPAD_REVIEW_SYSTEM = `
Jesteś recenzentem asystenta lektora w edytorze notatek lekcyjnych.
Sprawdź, czy odpowiedź:
1. Ściśle realizuje polecenie lektora i formatuje treść wg 4/5 bloków (Podsumowanie, Słownictwo, Korekty, Zadanie domowe, Kolejna lekcja),
2. Nie gubi żadnych kluczowych danych z załączonych dokumentów/materiałów,
3. Zachowuje czysty format i poprawną strukturę.

Wypisz zastrzeżenia lub napisz „Brak zastrzeżeń."
`.trim();

const reviseSystemSuffix = `

ETAP POPRAWEK: Masz przed sobą własną propozycję i zastrzeżenia recenzentów. Popraw propozycję tam, gdzie zastrzeżenie jest słuszne.
Zwróć PEŁNĄ, poprawioną odpowiedź w tym samym formacie, co poprzednio. Bez komentarza o zmianach — sam wynik.`;

/**
 * Przeprowadza wielomodelową naradę AI (Autor + Recenzenci).
 */
export async function runCouncil<T = any>({
  config = DEFAULT_COUNCIL,
  systemInstruction,
  prompt,
  reviewerSystemInstruction,
  expectJson = true,
  onEvent,
}: {
  config?: CouncilConfig;
  systemInstruction: string;
  prompt: string;
  reviewerSystemInstruction?: string;
  expectJson?: boolean;
  onEvent?: (event: CouncilEvent) => void;
}): Promise<CouncilResult<T>> {
  const normConfig = normalizeCouncil(config);
  const seats = normConfig.seats.filter(seat => seat.enabled);
  const author = seats.find(seat => seat.role === 'author') || seats[0] || DEFAULT_COUNCIL.seats[0];
  const reviewers = normConfig.enabled
    ? seats.filter(seat => seat.role === 'reviewer' && seat.id !== author.id)
    : [];

  const transcript: CouncilEvent[] = [];
  const record = (event: CouncilEvent) => {
    transcript.push(event);
    onEvent?.(event);
  };

  const reviewInstruction = reviewerSystemInstruction || DEFAULT_REVIEW_SYSTEM;

  const run = async (
    seat: CouncilSeat,
    phase: CouncilEvent['phase'],
    system: string,
    body: string,
    wantsJson: boolean = false
  ): Promise<string> => {
    const startedAt = Date.now();
    const { text, modelUsed } = await generateLessonPlannerAI({
      prompt: body,
      systemInstruction: system,
      preferredModels: cascadeFor(seat.model),
      jsonMode: wantsJson,
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

  // ── Tura 1: Autor pisze pierwszą wersję ──
  let draft = await run(author, 'draft', systemInstruction, prompt, expectJson);
  let finalModel = transcript[transcript.length - 1]?.model || author.model;

  // ── Tura 2: Recenzenci oceniają draft ──
  const critiques: string[] = [];
  for (const reviewer of reviewers) {
    try {
      const critique = await run(
        reviewer,
        'review',
        reviewInstruction,
        `WYTYCZNE OBOWIĄZUJĄCE AUTORA:\n${systemInstruction}\n\n=====\n\nPOLECENIE:\n${prompt}\n\n=====\n\nPROPOZYCJA AUTORA DO RECENZJI:\n${draft}`
      );
      const clean = critique.trim();
      if (clean && !/^brak zastrzeżeń\.?$/i.test(clean)) {
        critiques.push(clean);
      }
    } catch (err) {
      console.warn(`[Narada AI] Recenzent ${reviewer.model} nie odpowiedział:`, err);
    }
  }

  // ── Tura 3: Autor nanosi poprawki ──
  if (critiques.length > 0) {
    try {
      draft = await run(
        author,
        'revise',
        systemInstruction + reviseSystemSuffix,
        `POLECENIE:\n${prompt}\n\n=====\n\nTWOJA POPRZEDNIA PROPOZYCJA:\n${draft}\n\n=====\n\nZASTRZEŻENIA RECENZENTÓW DO UWZGLĘDNIENIA:\n${critiques
          .map((c, i) => `--- Recenzent ${i + 1} ---\n${c}`)
          .join('\n\n')}`,
        expectJson
      );
      finalModel = transcript[transcript.length - 1]?.model || finalModel;
    } catch (err) {
      console.warn('[Narada AI] Etap poprawek nie powiódł się — zachowano wersję roboczą autora:', err);
    }
  }

  if (!expectJson) {
    return { data: draft as unknown as T, raw: draft, transcript, finalModel };
  }

  try {
    return { data: JSON.parse(extractJSON(draft)) as T, raw: draft, transcript, finalModel };
  } catch {
    throw new Error(
      'Model zwrócił odpowiedź, której nie da się odczytać jako JSON. Spróbuj ponownie.'
    );
  }
}
