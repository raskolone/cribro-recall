import { LessonBlocks, LessonRecord, QuestionUsageLog } from '../types';

/**
 * Transkrypcja rozmowy → cztery bloki lekcji oraz ukryte logi pytań
 * wg specyfikacji Workflow: Lesson Processing Workflow for external app.
 *
 * ══ ŹRÓDŁO FAKTÓW I KONTRAKT DANYCH ══
 *
 * 1. Transkrypcja jest jedynym źródłem faktów.
 * 2. Oddzielamy wypowiedzi kursanta od wypowiedzi i przykładów lektora.
 * 3. Ekstrakcja 4 bloków Notion (Words & Phrases, Grammar & Accuracy, Pronunciation, Homework).
 * 4. Trwałe obserwacje profilowe kursanta (studentInsights) dla CRM.
 * 5. Ukryta baza pytań lektora (questionUsageLogs) dla analityki i trenowania Plannera.
 */

export const TRANSCRIPT_SYSTEM_INSTRUCTION = `Jesteś profesjonalnym analitykiem i asystentem lektora języka angielskiego CRIBRO. Dostajesz pełny zapis rozmowy z lekcji (transkrypcję automatyczną) i generujesz ustrukturyzowane, precyzyjne podsumowanie spotkania zgodnie ze standardem Lesson Processing Workflow & 4 Notion Blocks.

ŻELAZNE ZASADY HIERARCHII WIARYGODNOŚCI:
1. ŹRÓDŁEM FAKTÓW JEST WYŁĄCZNIE PEŁNA TRANSKRYPCJA: Nie generuj faktów, błędów, słownictwa ani ustaleń, których nie potwierdza zapis. Jeśli czegoś nie można ustalić, użyj 'insufficient_data' lub 'Brak danych w transkrypcji.'.
2. ODDZIELAJ ROLE ROZMÓWCÓW:
   - Wypowiedzi kursanta (błędy, treść wypowiedzi, preferencje, praca, sytuacje).
   - Pytania oraz instrukcje lektora (analizowane do ukrytej bazy pytań i Learning Curve).
   - Przykłady lektora (NIE traktuj słów z przykładów lektora jako materiału kursanta).
   - Faktyczne korekty i błędy.
   - Pytania techniczne/organizacyjne (pomijaj w merytorycznej analizie).
3. SŁOWNICTWO (ZASADA 80/20): Wybieraj wyłącznie słowa RZECZYWIŚCIE nowe ('new') lub nadal problematyczne ('needs_practice'). Pomijaj słowa, które kursant znał i użył poprawnie bez problemu. Format: 'angielskie hasło — polskie tłumaczenie'.
4. KOREKTY (MAX 3): Maksymalnie 3 najważniejsze błędy gramatyczne kursanta w formacie: '❌ [błąd] → ✅ [poprawna forma] — [krótka zasada]'. Dodaj sekcję 'Pronunciation:' dla trudnych słów.
5. WYPOWIEDZI KURSANTA & PROFIL (3-6 ZDAŃ): Wyciągnij trwałe informacje przydatne do kolejnych lekcji (praca, sytuacje komunikacyjne, zainteresowania, cele, preferencje).
6. PRACA DOMOWA: 4 zróżnicowane mechanizmy (Translation PL→EN 6 zdań, Correct Mistake 4 zdania, Finish Response 4 sytuacje, Build Sentence 4 wskazówki) + Answer Key.
7. UKRYTA BAZA PYTAŃ (Question Usage Log): Zapisz merytoryczne pytania lektora z klasyfikacją (origin: planned/adapted/spontaneous, questionQuality, anonymousPattern, studentResponse, plannerInsight).
8. Odpowiadasz WYŁĄCZNIE poprawnym obiektem JSON o zadanej strukturze.`;

export interface TranscriptLessonInput {
  transcript: string;
  studentName?: string;
  studentId?: string;
  lessonId?: string;
  /** Data lekcji (YYYY-MM-DD) — trafia do notatki. */
  date?: string;
  /** Godzina spotkania (np. 18:00) */
  time?: string;
  /** Temat, jeśli lektor już go zna. */
  topic?: string;
  /** Scenariusz przypisany do lekcji, jeśli istnieje. */
  scenarioTopic?: string;
  scenarioContent?: string;
  /** Poziom kursanta z profilu, np. „B1". */
  level?: string;
}

/** Polecenie dla modelu generujące pełne podsumowanie spotkania */
export function buildTranscriptLessonPrompt(input: TranscriptLessonInput): string {
  const { transcript, studentName, date, time, topic, scenarioTopic, scenarioContent, level } = input;

  const context = [
    studentName ? `Kursant: ${studentName}` : null,
    level ? `Poziom kursanta: ${level}` : null,
    date ? `Data lekcji: ${date}` : null,
    time ? `Godzina lekcji: ${time}` : null,
    topic ? `Temat planowany: ${topic}` : null,
    scenarioTopic ? `Scenariusz lekcji: ${scenarioTopic}` : null,
    scenarioContent ? `Założenia scenariusza: ${scenarioContent.slice(0, 500)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const dateTimeLabel = date
    ? `Data i godzina spotkania: ${date}${time ? `, ${time}` : ''}`
    : 'Data i godzina spotkania: [data lekcji, godzina]';

  return `${context ? `${context}\n\n` : ''}ZAPIS ROZMOWY Z LEKCJI (TRANSKRYPCJA):
"""
${transcript.trim()}
"""

Przygotuj kompletną analizę lekcji jako obiekt JSON o dokładnie takich polach:

{
  "topic": "krótki, konkretny temat zrealizowany na lekcji (do 80 znaków) — o czym była rozmowa",
  
  "summary": "BLOK 1a: Ogólne podsumowanie lekcji.\\nPierwsza linia: '${dateTimeLabel}'.\\nPod datą napisz 2-3 proste zdania ciągłym tekstem (bez punktorów):\\n1. Na lekcji rozmawialiśmy o...\\n2. Przećwiczyliśmy...\\n3. Skupiliśmy się też na...",

  "studentSpeaking": "BLOK 1b: Najważniejsze informacje z wypowiedzi kursanta (NOTATKA DLA LEKTORA).\\nNagłówek: 'Najważniejsze informacje z wypowiedzi kursanta:'\\nWypunktuj 3-6 najważniejszych rzeczy, o których kursant rzeczywiście opowiadał (praca, plany wyjazdowe, sytuacje, opinie). Każdy punkt to krótkie, pełne zdanie. Jeśli brak danych, wpisz 'Brak danych w transkrypcji.'",

  "studentInsights": "Trwałe obserwacje profilowe kursanta do CRM (praca, sytuacje komunikacyjne, zainteresowania, cele, preferencje edukacyjne, unikanie struktur). 3-5 zwięzłych zdań.",

  "vocabulary": "BLOK 2a: Słownictwo i zwroty.\\nSekcja 'Nowe:' (max 6-8 pozycji łącznie z powtórkami) w formacie: 'angielskie hasło — polskie tłumaczenie'.\\nSekcja 'Powtórka — nadal wymaga pracy:' (jeśli dotyczy).",

  "corrections": "BLOK 2b: Korekty i wymowa.\\n'Corrections:' (max 3 błędy w formacie: '❌ [błąd] → ✅ [poprawna forma] — [krótka zasada]').\\n'Pronunciation:' (max 2-3 elementy w formacie: 'słowo — /wymowa/ — [akcent/uwaga]').",

  "homework": "BLOK 3a: Praca domowa — Cribro Habit (DLA LEKTORA).\\nZadanie 1 — Translation PL→EN (dokładnie 6 zdań po polsku do przetłumaczenia)\\nZadanie 2 — Correct the Mistake (4 zdania po angielsku z celowym błędem)\\nZadanie 3 — Finish the Response (4 krótkie mini-dialogi / sytuacje)\\nZadanie 4 — Build a Natural Sentence (4 zestawy wskazówek do ułożenia zdania)",

  "answerKey": "BLOK 3b: Answer Key — klucz odpowiedzi do wszystkich 4 zadań domowych",

  "nextLesson": "BLOK 4: Plan na kolejną lekcję & Teacher memory (DLA LEKTORA).\\n'Next lesson:' (max 3 punkty: co sprawdzić, jaki błąd powtórzyć, scenka).\\n'Teacher memory — opcjonalnie:' (max 2 informacje pomocne w przygotowaniu lekcji).",

  "learningCurve": "Learning Curve: Analiza pytań i dynamiki rozmowy lektora z kursantem (Planned vs Actual, Origin, Response, Quality, Learning).",

  "questionUsageLogs": [
    {
      "sequence": 1,
      "actualQuestion": "faktyczne brzmienie pytania lektora z transkrypcji",
      "plannedQuestion": "pytanie ze scenariusza jeśli istniało",
      "origin": "planned | adapted | spontaneous",
      "section": "warm_up | main_topic | follow_up | spontaneous",
      "questionFunction": "experience | opinion | explanation | story | clarification | preference",
      "cefrLevel": "${level || 'B1'}",
      "anonymousPattern": "uogólniony wzorzec z placeholderami np. How do you usually handle [a work problem]?",
      "studentResponse": "expanded | natural | short | no_response",
      "questionQuality": "natural_and_relevant | natural_but_misaligned | robotic | unclear | too_difficult | insufficient_data",
      "conversationDirection": "krótko: w jaką stronę kursant poprowadził rozmowę",
      "plannerInsight": "konkretna instrukcja dla przyszłego Lesson Plannera"
    }
  ]
}

Wszystkie pola tekstowe muszą być w formacie Markdown. Zwróć wyłącznie poprawny obiekt JSON.`;
}

/** Surowa odpowiedź modelu */
interface RawTranscriptLesson {
  topic?: unknown;
  summary?: unknown;
  studentSpeaking?: unknown;
  studentInsights?: unknown;
  vocabulary?: unknown;
  corrections?: unknown;
  homework?: unknown;
  answerKey?: unknown;
  nextLesson?: unknown;
  learningCurve?: unknown;
  questionUsageLogs?: unknown[];
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export class TranscriptLessonError extends Error {}

/**
 * Czyści i sanityzuje surowy tekst odpowiedzi modelu przed parsowaniem JSON:
 * - Wycina znaczniki markdown (```json i ```)
 * - Odcina tekst przed pierwszą klamrą '{' i po ostatniej klamrze '}'
 * - Zabezpiecza unescaped newlines i znaki kontrolne wewnątrz stringów
 */
export function sanitizeJsonText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();

  // Wytnij znaczniki markdown ```json ... ``` lub ``` ... ```
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Odetnij wszystko przed pierwszą klamrą '{' i po ostatniej '}'
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

/**
 * Rozbiór odpowiedzi modelu do formatu rekordu lekcji.
 */
export function parseTranscriptLesson(
  raw: string,
  metadata?: { lessonId?: string; studentId?: string; date?: string }
): Partial<LessonRecord> {
  const sanitized = sanitizeJsonText(raw);
  let parsed: RawTranscriptLesson;
  try {
    parsed = JSON.parse(sanitized) as RawTranscriptLesson;
  } catch (err: any) {
    // Drugie podejście: próba usunięcia znaków kontrolnych ASCII (poza \n, \r, \t)
    try {
      const cleanControlChars = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
      parsed = JSON.parse(cleanControlChars) as RawTranscriptLesson;
    } catch {
      throw new TranscriptLessonError('Model nie zwrócił poprawnego JSON-a.');
    }
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
  const studentInsights = asText(parsed.studentInsights) || studentSpeaking;

  if (!blocks.summary && !blocks.vocabulary) {
    throw new TranscriptLessonError(
      'Z tej transkrypcji nie dało się zbudować lekcji — model nie zwrócił ani podsumowania, ani słownictwa.'
    );
  }

  const topic = asText(parsed.topic).slice(0, 200);

  // Parsowanie pytań do QuestionUsageLog
  const rawLogs = Array.isArray(parsed.questionUsageLogs) ? parsed.questionUsageLogs : [];
  const lessonDate = metadata?.date || new Date().toISOString().split('T')[0];
  const lessonId = metadata?.lessonId || `lesson_${Date.now()}`;
  const studentId = metadata?.studentId || '';
  const nowIso = new Date().toISOString();

  const questionUsageLogs: QuestionUsageLog[] = rawLogs
    .filter((q): q is Record<string, any> => Boolean(q && typeof q === 'object'))
    .map((q, idx) => {
      const actualQuestion = asText(q.actualQuestion);
      if (!actualQuestion) return null;

      const validOrigins: Array<QuestionUsageLog['origin']> = ['planned', 'adapted', 'spontaneous'];
      const origin = validOrigins.includes(q.origin) ? q.origin : 'spontaneous';

      const validSections: Array<QuestionUsageLog['section']> = ['warm_up', 'main_topic', 'follow_up', 'spontaneous'];
      const section = validSections.includes(q.section) ? q.section : 'main_topic';

      const validFunctions: Array<QuestionUsageLog['questionFunction']> = [
        'experience', 'opinion', 'explanation', 'story', 'clarification', 'preference'
      ];
      const questionFunction = validFunctions.includes(q.questionFunction) ? q.questionFunction : 'opinion';

      const validResponses: Array<QuestionUsageLog['studentResponse']> = ['expanded', 'natural', 'short', 'no_response'];
      const studentResponse = validResponses.includes(q.studentResponse) ? q.studentResponse : 'natural';

      const validQualities: Array<QuestionUsageLog['questionQuality']> = [
        'natural_and_relevant', 'natural_but_misaligned', 'robotic', 'unclear', 'too_difficult', 'insufficient_data'
      ];
      const questionQuality = validQualities.includes(q.questionQuality) ? q.questionQuality : 'natural_and_relevant';

      return {
        questionLogId: `ql_${lessonId}_${idx + 1}`,
        lessonId,
        studentId,
        lessonDate,
        sequence: Number(q.sequence) || (idx + 1),
        actualQuestion,
        plannedQuestion: asText(q.plannedQuestion) || undefined,
        origin,
        section,
        questionFunction,
        cefrLevel: asText(q.cefrLevel) || 'B1',
        anonymousPattern: asText(q.anonymousPattern) || actualQuestion,
        studentResponse,
        questionQuality,
        conversationDirection: asText(q.conversationDirection) || undefined,
        plannerInsight: asText(q.plannerInsight) || undefined,
        createdAt: nowIso,
        analysisVersion: 'v2026-09-16',
      } as QuestionUsageLog;
    })
    .filter((log): log is QuestionUsageLog => Boolean(log));

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
    studentInsights: studentInsights,
    questionUsageLogs: questionUsageLogs.length > 0 ? questionUsageLogs : undefined,
    processingRunId: `run_${Date.now()}`,
    analysisVersion: 'v2026-09-16',
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

