import { LessonBlocks, LessonRecord } from '../types';

/**
 * Transkrypcja rozmowy → cztery bloki lekcji wg specyfikacji Skill - Meeting Summary.
 *
 * ══ DLACZEGO TEN SAM KONTRAKT, CO NOTION ══
 *
 * Lekcja z transkrypcji musi wyjść w tym samym kształcie, co lekcja z Notion
 * (`Words & Phrases`, `Grammar & Accuracy`, `Pronunciation`, `Homework`, `Student Speaking`) —
 * nie dla porządku, ale dlatego, że wszystko dalej czyta właśnie ten kształt:
 * fiszki, prace domowe, learning curve, eksport do PDF.
 */

export const TRANSCRIPT_SYSTEM_INSTRUCTION = `Jesteś profesjonalnym asystentem lektora języka angielskiego CRIBRO. Dostajesz pełny zapis rozmowy z lekcji (transkrypcję automatyczną) i generujesz ustrukturyzowane, precyzyjne podsumowanie spotkania zgodnie ze standardem Skill - Meeting Summary.

ŻELAZNE ZASADY:
1. ŹRÓDŁEM FAKTÓW JEST WYŁĄCZNIE TRANSKRYPCJA: Nie wymyślaj błędów, słownictwa, wypowiedzi kursanta ani ustaleń, których nie potwierdza zapis.
2. ODDZIELAJ KURSANTA OD LEKTORA: Rozpoznawaj wypowiedzi KURSANTA. To, co powiedział lektor, to kontekst lub wzorzec, a nie materiał do poprawiania.
3. ZASADA 80/20 I INTELIGENTNY WYBÓR SŁOWNICTWA: Do słownictwa (max 6-8 pozycji) dodawaj wyłącznie słowa RZECZYWIŚCIE nowe lub wymagające powtórki. Pomijaj słowa, które kursant znał i użył poprawnie oraz chwilowe zawahania.
4. KOREKTY (MAX 3): Wybierz maksymalnie 3 najważniejsze błędy gramatyczne kursanta w formacie: ❌ [błąd] → ✅ [poprawna forma] — [krótka zasada].
5. WYPOWIEDZI KURSANTA (DLA LEKTORA): Wyciągnij 3-6 konkretnych faktów, o których kursant opowiadał (praca, plany, sytuacje), aby lektor miał gotowy kontekst przed kolejną lekcją.
6. PRACA DOMOWA (DLA LEKTORA): 4 zróżnicowane mechanizmy (Translation PL→EN 6 zdań, Correct Mistake 4 zdania, Finish Response 4 sytuacje, Build Sentence 4 wskazówki) + Answer Key.
7. Odpowiadasz WYŁĄCZNIE poprawnym obiektem JSON o zadanej strukturze.`;

export interface TranscriptLessonInput {
  transcript: string;
  studentName?: string;
  /** Data lekcji (YYYY-MM-DD) — trafia do notatki. */
  date?: string;
  /** Godzina spotkania (np. 18:00) */
  time?: string;
  /** Temat, jeśli lektor już go zna. */
  topic?: string;
  /** Poziom kursanta z profilu, np. „B1". */
  level?: string;
}

/** Polecenie dla modelu generujące pełne podsumowanie spotkania */
export function buildTranscriptLessonPrompt(input: TranscriptLessonInput): string {
  const { transcript, studentName, date, time, topic, level } = input;

  const context = [
    studentName ? `Kursant: ${studentName}` : null,
    level ? `Poziom kursanta: ${level}` : null,
    date ? `Data lekcji: ${date}` : null,
    time ? `Godzina lekcji: ${time}` : null,
    topic ? `Temat planowany: ${topic}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const dateTimeLabel = date
    ? `Data i godzina spotkania: ${date}${time ? `, ${time}` : ''}`
    : 'Data i godzina spotkania: [data lekcji, godzina]';

  return `${context ? `${context}\n\n` : ''}ZAPIS ROZMOWY Z LEKCJI:
"""
${transcript.trim()}
"""

Przygotuj podsumowanie lekcji jako obiekt JSON o dokładnie takich polach:

{
  "topic": "krótki, konkretny temat lekcji (do 80 znaków) — o czym była rozmowa",
  
  "summary": "BLOK 1a: Ogólne podsumowanie lekcji.\\nPierwsza linia: '${dateTimeLabel}'.\\nPod datą napisz 2-3 proste zdania ciągłym tekstem (bez punktorów):\\n1. Na lekcji rozmawialiśmy o...\\n2. Przećwiczyliśmy...\\n3. Skupiliśmy się też na...",

  "studentSpeaking": "BLOK 1b: Najważniejsze informacje z wypowiedzi kursanta (NOTATKA DLA LEKTORA).\\nNagłówek: 'Najważniejsze informacje z wypowiedzi kursanta:'\\nWypunktuj 3-6 najważniejszych rzeczy, o których kursant rzeczywiście opowiadał (praca, plany wyjazdowe, sytuacje, opinie). Każdy punkt to krótkie, pełne zdanie. Jeśli brak danych, wpisz 'Brak danych w transkrypcji.'",

  "vocabulary": "BLOK 2a: Słownictwo i zwroty.\\nSekcja 'Nowe:' (max 6-8 pozycji łącznie z powtórkami) w formacie: 'angielskie hasło — polskie tłumaczenie'.\\nSekcja 'Powtórka — nadal wymaga pracy:' (jeśli dotyczy).",

  "corrections": "BLOK 2b: Korekty i wymowa.\\n'Corrections:' (max 3 błędy w formacie: '❌ [błąd] → ✅ [poprawna forma] — [krótka zasada]').\\n'Pronunciation:' (max 2-3 elementy w formacie: 'słowo — /wymowa/ — [akcent/uwaga]').",

  "homework": "BLOK 3a: Praca domowa — Cribro Habit (DLA LEKTORA).\\nZadanie 1 — Translation PL→EN (dokładnie 6 zdań po polsku do przetłumaczenia)\\nZadanie 2 — Correct the Mistake (4 zdania po angielsku z celowym błędem)\\nZadanie 3 — Finish the Response (4 krótkie mini-dialogi / sytuacje)\\nZadanie 4 — Build a Natural Sentence (4 zestawy wskazówek do ułożenia zdania)",

  "answerKey": "BLOK 3b: Answer Key — klucz odpowiedzi do wszystkich 4 zadań domowych",

  "nextLesson": "BLOK 4: Plan na kolejną lekcję & Teacher memory (DLA LEKTORA).\\n'Next lesson:' (max 3 punkty: co sprawdzić, jaki błąd powtórzyć, scenka).\\n'Teacher memory — opcjonalnie:' (max 2 informacje pomocne w przygotowaniu lekcji).",

  "learningCurve": "Learning Curve: Analiza pytań i dynamiki rozmowy lektora z kursantem (Planned vs Actual, Origin, Response, Quality, Learning)."
}

Wszystkie pola muszą być tekstem w formacie Markdown. Zwróć wyłącznie poprawny obiekt JSON.`;
}

/** Surowa odpowiedź modelu */
interface RawTranscriptLesson {
  topic?: unknown;
  summary?: unknown;
  studentSpeaking?: unknown;
  vocabulary?: unknown;
  corrections?: unknown;
  homework?: unknown;
  answerKey?: unknown;
  nextLesson?: unknown;
  learningCurve?: unknown;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export class TranscriptLessonError extends Error {}

/**
 * Rozbiór odpowiedzi modelu do formatu rekordu lekcji.
 */
export function parseTranscriptLesson(raw: string): Partial<LessonRecord> {
  let parsed: RawTranscriptLesson;
  try {
    parsed = JSON.parse(raw) as RawTranscriptLesson;
  } catch {
    throw new TranscriptLessonError('Model nie zwrócił poprawnego JSON-a.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new TranscriptLessonError('Model zwrócił coś, co nie jest obiektem.');
  }

  const blocks: LessonBlocks = {
    summary: asText(parsed.summary),
    vocabulary: asText(parsed.vocabulary),
    corrections: asText(parsed.corrections),
    homework: asText(parsed.homework),
    answerKey: asText(parsed.answerKey),
    nextLesson: asText(parsed.nextLesson),
    learningCurve: asText(parsed.learningCurve),
  };

  const studentSpeaking = asText(parsed.studentSpeaking) || blocks.learningCurve || '';

  if (!blocks.summary && !blocks.vocabulary) {
    throw new TranscriptLessonError(
      'Z tej transkrypcji nie dało się zbudować lekcji — model nie zwrócił ani podsumowania, ani słownictwa.'
    );
  }

  const topic = asText(parsed.topic).slice(0, 200);

  return {
    ...(topic ? { topic } : {}),
    structuredBlocks: blocks,
    lessonSummary: blocks.summary,
    vocabularyText: blocks.vocabulary,
    corrections: blocks.corrections,
    homeworkText: blocks.homework,
    homeworkAnswerKey: blocks.answerKey,
    nextLessonPlan: blocks.nextLesson,
    studentSpeaking: studentSpeaking,
  };
}

/**
 * Zatwierdzenie lekcji przez lektora.
 */
export function approveTranscriptLesson(): Partial<LessonRecord> {
  return {
    sessionStatus: 'completed',
    status: 'confirmed',
    isPendingConfirmation: false,
    pendingReason: '',
  };
}
