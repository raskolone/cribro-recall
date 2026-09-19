import { GoogleGenAI, Type } from '@google/genai';
import type { Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import {
  SCENARIO_MODULE_IDS,
  ScenarioDurationMin,
  ScenarioModelOutput,
  LessonScenario,
} from '../types/scenario';
import { validateScenarioModelOutput, buildLessonScenario } from '../utils/scenarioValidation';
import { loadScenarioStudentContext } from './scenarioContextService';

/**
 * Modele dla dwuetapowego potoku "The Cribro Method" (Etap 2.1) — patrz
 * CHANGELOG.md sekcja S dla uzasadnienia wyboru gemini-2.5-pro/flash.
 */
const SCENARIO_DIDACTIC_MODEL = 'gemini-2.5-pro';
const SCENARIO_FORMATTING_MODEL = 'gemini-2.5-flash';

export interface GenerateScenarioForStudentParams {
  adminDb: Firestore;
  geminiApiKey: string;
  studentId: string;
  durationMin: ScenarioDurationMin;
  /** Opcjonalne doprecyzowanie tematu głównego modułu, np. z toola czatu. Max 150 znaków, trimowane. */
  customTopicFocus?: string;
  /**
   * Wstrzyknięte z `server.ts`, żeby nie duplikować kaskady retry/fallback
   * modeli, która już tam istnieje jako `generateContentWithRetry`.
   */
  generateContentWithRetry: (aiClient: any, contents: any, config: any, customModels?: string[]) => Promise<any>;
  geminiModelCascade: string[];
}

/**
 * Jedna, wspólna funkcja generująca scenariusz lekcji 2.0 — wołana zarówno
 * przez `POST /api/scenario/generate`, jak i przez tool czatu
 * `generate_lesson_scenario`. Cały potok (odczyt kontekstu kursanta,
 * dwuetapowe wywołanie Gemini, walidacja, nadanie budżetów czasowych)
 * żyje wyłącznie tutaj — zero dublowania między endpointem a toolem.
 */
export async function generateScenarioForStudent(
  params: GenerateScenarioForStudentParams
): Promise<LessonScenario> {
  const { adminDb, geminiApiKey, studentId, durationMin, customTopicFocus, generateContentWithRetry, geminiModelCascade } = params;

  const { mode, cefr, profileContext, lastLessonContext, errorWorkInstruction } =
    await loadScenarioStudentContext(adminDb, studentId);

  const customFocusInstruction = customTopicFocus
    ? `\n\nDODATKOWA WYTYCZNA OD LEKTORA (uwzględnij ją w module "main_topic" jako priorytet nad domyślnym doborem sytuacji): ${customTopicFocus}`
    : '';

  /* ── ETAP 1 (model dydaktyczny): rozumowanie pedagogiczne, wolny tekst,
     bez schematu JSON — narzucenie JSON-a na tym etapie spłaszcza jakość
     treści do formularza. Rygor "The Cribro Method": zero korpo-żargonu,
     warm-up zakotwiczony w konkretnym dniu/sytuacji, jedna konkretna
     sytuacja zawodowa w main_topic + wskazówki ratunkowe dla lektora. ── */
  const didacticPrompt = `Jesteś doświadczonym metodykiem języka angielskiego (1:1, kursy zawodowe), układającym scenariusz KONKRETNEJ lekcji dla konkretnego lektora i konkretnego kursanta. Nie piszesz podręcznika ani ankiety ewaluacyjnej — piszesz notatki robocze dla lektora, który za chwilę usiądzie z tą osobą.

PROFIL KURSANTA:
${profileContext}

KONTEKST Z OSTATNIEJ LEKCJI:
${lastLessonContext}

PARAMETRY LEKCJI:
Długość: ${durationMin} minut
Tryb: ${mode === 'returning' ? 'kursant powracający (returning)' : 'pierwszy kontakt / brak historii (cold_start)'}

TEST NATURALNOŚCI (obowiązkowy, sprawdź każde zdanie przed oddaniem odpowiedzi):
- Każde pytanie i polecenie musi brzmieć jak żywa rozmowa dwóch ludzi, NIGDY jak formularz ewaluacyjny, ankieta HR ani lista kontrolna.
- Zakazane słowa-klucze i ich polskie odpowiedniki (nie używaj ich w ogóle): "headspace", "bandwidth", "leverage", "facilitate", "synergy", "touch base", "circle back", "actionable", "streamline", "usprawnić", "wdrożyć synergię", "przestrzeń mentalną".
- Jeśli zdanie brzmi jak coś, co powiedziałby dział HR albo konsultant, przepisz je jak zwykłą rozmowę przy kawie.

STRUKTURA (dokładnie 4 bloki, w tej kolejności):

1. WARM-UP / FOLLOW-UP — rozgrzewka zakotwiczona w KONKRETNYM dniu i konkretnym doświadczeniu kursanta (np. nawiązanie do sytuacji z ostatniej lekcji, konkretnego wydarzenia w pracy, konkretnego dnia tygodnia). Nigdy ogólnikowe "How was your week?" ani "How are you?" bez punktu zaczepienia.

2. PRACA NA BŁĘDACH — ${errorWorkInstruction} Podaj konkretne zdania/sytuacje do przećwiczenia, odwołujące się wprost do błędów i słownictwa z kontekstu wyżej (nie wymyślaj nowych, niepowiązanych błędów).

3. GŁÓWNY TEMAT — dokładnie JEDNA konkretna sytuacja z pracy kursanta (np. konkretna linia produkcyjna, konkretny wskaźnik/proces, konkretna eskalacja problemu, konkretne spotkanie) — nie ogólny temat branżowy. Rozwiń ją w pytania i zadania na poziomie ${cefr}. Dodatkowo przygotuj DLA LEKTORA sekcję "Wskazówki ratunkowe" — 2-4 prostsze, awaryjne pytania/podpowiedzi na wypadek, gdyby kursant odpowiedział jednym słowem albo utknął i milczał. Te wskazówki są dla lektora, nie dla kursanta.${customFocusInstruction}

4. PODSUMOWANIE I FEEDBACK — krótkie podsumowanie lekcji, konkretny feedback dla kursanta, zapowiedź pracy domowej nawiązująca do tematu głównego.

Dla każdego z 4 bloków podaj jednozdaniowy cel oraz listę 1-6 konkretnych, samodzielnych punktów (pytań/ćwiczeń/zwrotów) do realizacji na żywo. Nie podawaj czasów trwania ani identyfikatorów. Odpowiedz zwykłym tekstem, jasno opisując bloki po kolei — o formatowanie do JSON zadba kolejny etap.`;

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const didacticResponse = await generateContentWithRetry(
    ai,
    didacticPrompt,
    {},
    [SCENARIO_DIDACTIC_MODEL, ...geminiModelCascade]
  );

  if (!didacticResponse.text) throw new Error('Brak odpowiedzi z modelu dydaktycznego AI.');
  const didacticText = String(didacticResponse.text).trim();

  /* ── ETAP 2 (model formatujący): wyłącznie przepisanie merytorycznej
     treści z Etapu 1 na ścisły JSON. ── */
  const schema = {
    type: Type.OBJECT,
    properties: {
      modules: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            moduleId: { type: Type.STRING, enum: [...SCENARIO_MODULE_IDS] },
            objective: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { text: { type: Type.STRING } },
                required: ['text'],
              },
            },
            teacherNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['moduleId', 'objective', 'items'],
        },
      },
    },
    required: ['modules'],
  };

  const formattingPrompt = `Poniżej jest gotowy merytorycznie scenariusz lekcji, ułożony przez metodyka. Twoje jedyne zadanie: przepisać go WIERNIE (bez zmiany treści, bez skracania, bez parafrazowania) na strukturę JSON zgodną ze schematem.

Zasady przepisania:
- DOKŁADNIE 4 moduły w tej kolejności: "warmup_followup", "error_work", "main_topic", "wrapup_feedback".
- Każdy moduł: "objective" (jednozdaniowy cel z tekstu), "items" (1-6 punktów — każdy punkt jako osobny, samodzielny tekst, bez numeracji i bez markdown).
- Moduł "main_topic" musi mieć dodatkowo "teacherNotes": listę wskazówek ratunkowych dla lektora z tekstu (sekcja "Wskazówki ratunkowe") — jeśli tekst nie nazywa ich wprost, wyodrębnij zdania, które pełnią tę funkcję.
- Nie dodawaj własnej treści, nie koryguj merytoryki — tylko formatowanie.

SCENARIUSZ DO PRZEPISANIA:
${didacticText}`;

  const response = await generateContentWithRetry(
    ai,
    formattingPrompt,
    { responseMimeType: 'application/json', responseSchema: schema },
    [SCENARIO_FORMATTING_MODEL, ...geminiModelCascade]
  );

  if (!response.text) throw new Error('Brak odpowiedzi z modelu formatującego AI.');

  const cleanText = String(response.text).replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
  const parsed = JSON.parse(cleanText) as ScenarioModelOutput;

  validateScenarioModelOutput(parsed);

  return buildLessonScenario(
    parsed,
    { studentId, durationMin, mode, generatedAt: new Date().toISOString() },
    randomUUID
  );
}
