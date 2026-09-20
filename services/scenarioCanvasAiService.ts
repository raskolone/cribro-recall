import { GoogleGenAI, Type } from '@google/genai';
import type { Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { ScenarioDurationMin } from '../types/scenario';
import {
  CanvasAuditorOutput,
  CanvasBlockId,
  CanvasPlannerOutput,
  CanvasRefreshOutput,
  ScenarioCanvasV2,
} from '../types/scenarioCanvas';
import {
  applyCanvasAuditorPatch,
  applyLessonRefresh,
  buildScenarioCanvas,
  computeApplicableCanvasBlockIds,
  validateCanvasAuditorOutput,
  validateCanvasPlannerOutput,
  validateCanvasRefreshOutput,
} from '../utils/scenarioCanvasValidation';
import { loadScenarioStudentContext } from './scenarioContextService';

/**
 * Modele dla potoku Planner → Auditor Canvasu 2.0 — wyłącznie kaskada
 * Gemini (patrz CLAUDE.md: brak OpenAI SDK/fallbacków w tej ścieżce).
 * Ten sam wzorzec co `scenarioAiService.ts`: dydaktyka na mocniejszym
 * modelu, formatowanie/audyt na szybszym.
 */
const CANVAS_PLANNER_MODEL = 'gemini-2.5-pro';
const CANVAS_FORMATTING_MODEL = 'gemini-2.5-flash';
const CANVAS_AUDITOR_MODEL = 'gemini-2.5-flash';
const CANVAS_REFRESH_MODEL = 'gemini-2.5-flash';

type GenerateContentWithRetry = (aiClient: any, contents: any, config: any, customModels?: string[]) => Promise<any>;

export interface GenerateScenarioCanvasParams {
  adminDb: Firestore;
  geminiApiKey: string;
  studentId: string;
  durationMin: ScenarioDurationMin;
  generateContentWithRetry: GenerateContentWithRetry;
  geminiModelCascade: string[];
}

const CANVAS_BLOCK_LABELS: Record<CanvasBlockId, string> = {
  lesson_goal: 'Cel lekcji (jedno zdanie, callout na górze canvasu)',
  warm_up: 'Rozgrzewka',
  revision_translation: 'Powtórka / tłumaczenie',
  older_lesson_refresh: 'Przypomnienie starszej lekcji (recykling materiału sprzed kilku spotkań)',
  grammar_review: 'Powtórka gramatyki',
  main_topic: 'Główny temat',
  language_focus: 'Language focus (słownictwo/zwroty do utrwalenia)',
  practice_enclosure: 'Zamknięcie ćwiczeniowe (krótka praktyka utrwalająca)',
  homework: 'Praca domowa',
};

function plannerBlockSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      blockId: { type: Type.STRING },
      objective: { type: Type.STRING },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            kind: { type: Type.STRING, enum: ['question', 'task', 'note', 'rescue_question', 'wind_down_question'] },
            text: { type: Type.STRING },
          },
          required: ['kind', 'text'],
        },
      },
      teacherNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['blockId', 'objective', 'items'],
  };
}

/**
 * Jedna, wspólna funkcja generująca Canvas 2.0 — Planner (treść 9 bloków w
 * response schema JSON) + Auditor (patch po itemId dla sztucznych/nudnych
 * pytań). Zwraca DRAFT — zapis następuje wyłącznie na żądanie lektora z UI
 * (patrz `POST /api/scenario/canvas/save` w server.ts).
 */
export async function generateScenarioCanvasForStudent(params: GenerateScenarioCanvasParams): Promise<ScenarioCanvasV2> {
  const { adminDb, geminiApiKey, studentId, durationMin, generateContentWithRetry, geminiModelCascade } = params;

  const { mode, cefr, profileContext, lastLessonContext, hasGrammarContext, grammarContext } =
    await loadScenarioStudentContext(adminDb, studentId);

  const applicableBlockIds = computeApplicableCanvasBlockIds(mode, hasGrammarContext);
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const blockListText = applicableBlockIds.map((id, idx) => `${idx + 1}. ${id} — ${CANVAS_BLOCK_LABELS[id]}`).join('\n');

  const plannerPrompt = `Jesteś doświadczonym metodykiem języka angielskiego (1:1, kursy zawodowe), układającym Canvas KONKRETNEJ lekcji dla konkretnego lektora i kursanta. Piszesz notatki robocze dla lektora, nie podręcznik ani ankietę.

PROFIL KURSANTA:
${profileContext}

KONTEKST Z OSTATNIEJ LEKCJI:
${lastLessonContext}

KONTEKST GRAMATYCZNY DO POWTÓRKI (jeśli dotyczy):
${grammarContext || 'brak'}

PARAMETRY LEKCJI:
Długość: ${durationMin} minut
Tryb: ${mode === 'returning' ? 'kursant powracający (returning)' : 'pierwszy kontakt / brak historii (cold_start)'}

TEST NATURALNOŚCI (obowiązkowy): każde pytanie/polecenie brzmi jak żywa rozmowa dwóch ludzi, nigdy jak formularz ewaluacyjny ani ankieta HR. Zero korpo-żargonu ("leverage", "synergy", "usprawnić" itp.).

STRUKTURA — dokładnie te bloki, w tej kolejności:
${blockListText}

Dla każdego bloku podaj jednozdaniowy cel ("objective") oraz 1-6 konkretnych, samodzielnych punktów ("items"), każdy z polem "kind" ("question", "task" lub "note").

Blok "main_topic" MUSI dodatkowo zawierać: dokładnie 2-3 punkty z "kind": "rescue_question" (prostsze, awaryjne pytania na wypadek, gdy kursant utknie) oraz DOKŁADNIE 1 punkt z "kind": "wind_down_question" (pytanie zamykające temat, przejście do kolejnego bloku). Do "teacherNotes" wpisz modele odpowiedzi i prompt ratunkowy dla lektora.

Nie podawaj czasów trwania ani identyfikatorów — o to zadba backend.`;

  const plannerSchema = {
    type: Type.OBJECT,
    properties: {
      blocks: { type: Type.ARRAY, items: plannerBlockSchema() },
    },
    required: ['blocks'],
  };

  const plannerResponse = await generateContentWithRetry(
    ai,
    plannerPrompt,
    { responseMimeType: 'application/json', responseSchema: plannerSchema },
    [CANVAS_PLANNER_MODEL, CANVAS_FORMATTING_MODEL, ...geminiModelCascade]
  );

  if (!plannerResponse.text) throw new Error('Brak odpowiedzi z modelu Planner AI.');
  const plannerClean = String(plannerResponse.text).replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
  const plannerParsed = JSON.parse(plannerClean) as CanvasPlannerOutput;

  validateCanvasPlannerOutput(plannerParsed, applicableBlockIds);

  const canvas = buildScenarioCanvas(
    plannerParsed,
    applicableBlockIds,
    { studentId, durationMin, mode, generatedAt: new Date().toISOString() },
    randomUUID
  );

  return auditScenarioCanvas(canvas, { geminiApiKey, generateContentWithRetry, geminiModelCascade, cefr });
}

/**
 * Auditor: dostaje zwalidowany plan i zwraca patch po itemId dla wykrytych
 * sztucznych/nudnych pytań. NIE generuje drugiego całego scenariusza —
 * tylko doprecyzowuje istniejące teksty.
 */
async function auditScenarioCanvas(
  canvas: ScenarioCanvasV2,
  opts: { geminiApiKey: string; generateContentWithRetry: GenerateContentWithRetry; geminiModelCascade: string[]; cefr: string }
): Promise<ScenarioCanvasV2> {
  const reviewableItems = canvas.blocks
    .filter((b) => !b.skipped)
    .flatMap((b) => b.items.map((it) => ({ blockId: b.blockId, itemId: it.itemId, kind: it.kind, text: it.text })));

  if (reviewableItems.length === 0) return canvas;

  const ai = new GoogleGenAI({ apiKey: opts.geminiApiKey });
  const auditorPrompt = `Jesteś surowym redaktorem scenariuszy lekcji angielskiego (poziom ${opts.cefr}). Poniżej jest lista punktów z gotowego Canvasu lekcji. Twoje JEDYNE zadanie: wskazać punkty, które brzmią sztucznie, nudno albo jak formularz/ankieta, i podać ich POPRAWIONĄ wersję (żywa, konkretna, naturalna rozmowa).

Zwróć patch WYŁĄCZNIE dla punktów wymagających poprawki — resztę pomiń (nie zwracaj patcha dla dobrych punktów). Nie twórz nowych punktów, nie zmieniaj ID, nie generuj nowego scenariusza od zera.

PUNKTY:
${reviewableItems.map((it) => `- itemId="${it.itemId}" [${it.blockId}/${it.kind}]: ${it.text}`).join('\n')}`;

  const auditorSchema = {
    type: Type.OBJECT,
    properties: {
      patches: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            itemId: { type: Type.STRING },
            text: { type: Type.STRING },
          },
          required: ['itemId', 'text'],
        },
      },
    },
    required: ['patches'],
  };

  const auditorResponse = await opts.generateContentWithRetry(
    ai,
    auditorPrompt,
    { responseMimeType: 'application/json', responseSchema: auditorSchema },
    [CANVAS_AUDITOR_MODEL, ...opts.geminiModelCascade]
  );

  if (!auditorResponse.text) return canvas;
  const cleanText = String(auditorResponse.text).replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
  const parsed = JSON.parse(cleanText) as CanvasAuditorOutput;

  validateCanvasAuditorOutput(parsed, canvas);
  return applyCanvasAuditorPatch(canvas, parsed.patches);
}

export interface RefreshScenarioCanvasParams {
  geminiApiKey: string;
  generateContentWithRetry: GenerateContentWithRetry;
  geminiModelCascade: string[];
  canvas: ScenarioCanvasV2;
  rejectedItemIds: string[];
  teacherNotes: { itemId: string; note: string }[];
  mutationId: string;
}

/**
 * Lesson Refresh: do Gemini wysyłamy WYŁĄCZNIE odrzucone elementy, uwagi
 * lektora i teksty zaakceptowanych kotwic (do unikania duplikatów) — BEZ
 * pełnego surowego transkryptu. Backend potem podmienia wyłącznie odrzucone
 * pozycje (patrz `applyLessonRefresh`).
 */
export async function refreshScenarioCanvasBlocks(params: RefreshScenarioCanvasParams): Promise<ScenarioCanvasV2> {
  const { geminiApiKey, generateContentWithRetry, geminiModelCascade, canvas, rejectedItemIds, teacherNotes, mutationId } = params;

  const allItems = canvas.blocks.flatMap((b) => b.items.map((it) => ({ ...it, blockId: b.blockId })));
  const rejectedSet = new Set(rejectedItemIds);
  const rejected = allItems.filter((it) => rejectedSet.has(it.itemId));
  const acceptedAnchors = allItems.filter((it) => it.review.state === 'accepted').map((it) => it.text);
  const noteByItemId = new Map(teacherNotes.map((n) => [n.itemId, n.note]));

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const prompt = `Jesteś metodykiem języka angielskiego. Lektor odrzucił poniższe punkty scenariusza lekcji i poprosił o ich podmianę. Zwróć DOKŁADNIE tyle nowych wersji, ile jest odrzuconych punktów, każdą przypisaną do TEGO SAMEGO itemId — nie dodawaj, nie usuwaj, nie zmieniaj ID.

ODRZUCONE PUNKTY I UWAGI LEKTORA:
${rejected.map((it) => `- itemId="${it.itemId}" [${it.blockId}/${it.kind}]: "${it.text}"${noteByItemId.get(it.itemId) ? ` — uwaga lektora: ${noteByItemId.get(it.itemId)}` : ''}`).join('\n')}

ZAAKCEPTOWANE PUNKTY (kotwice — nowe wersje NIE MOGĄ ich duplikować ani powtarzać tego samego pomysłu):
${acceptedAnchors.length ? acceptedAnchors.map((t) => `- ${t}`).join('\n') : 'brak'}

Zwróć każdy nowy punkt z tym samym "kind" co oryginał, chyba że uwaga lektora wyraźnie prosi o inny typ.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            itemId: { type: Type.STRING },
            kind: { type: Type.STRING, enum: ['question', 'task', 'note', 'rescue_question', 'wind_down_question'] },
            text: { type: Type.STRING },
          },
          required: ['itemId', 'kind', 'text'],
        },
      },
    },
    required: ['items'],
  };

  const response = await generateContentWithRetry(
    ai,
    prompt,
    { responseMimeType: 'application/json', responseSchema: schema },
    [CANVAS_REFRESH_MODEL, ...geminiModelCascade]
  );

  if (!response.text) throw new Error('Brak odpowiedzi z modelu Lesson Refresh AI.');
  const cleanText = String(response.text).replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
  const parsed = JSON.parse(cleanText) as CanvasRefreshOutput;

  validateCanvasRefreshOutput(parsed, rejectedItemIds);

  return applyLessonRefresh(canvas, parsed, mutationId, new Date().toISOString());
}
