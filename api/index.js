var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// firebase-applet-config.json
var require_firebase_applet_config = __commonJS({
  "firebase-applet-config.json"(exports, module) {
    module.exports = {
      projectId: "gen-lang-client-0425391821",
      appId: "1:170162955981:web:3ec788e8749cd3fd30ab84",
      apiKey: "AIzaSyB7f0KY2lWzJWps4eOyEBhFFo4_U8UWYvM",
      authDomain: "gen-lang-client-0425391821.firebaseapp.com",
      storageBucket: "gen-lang-client-0425391821.firebasestorage.app",
      messagingSenderId: "170162955981",
      measurementId: "",
      oAuthClientId: "170162955981-mft2dku72do6ehvl7cbqk03fpee04jhi.apps.googleusercontent.com",
      recaptchaSiteKey: ""
    };
  }
});

// utils/modelJsonList.ts
var stripFence = (raw) => raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/g, "").trim();
var extractListFromModelJson = (raw) => {
  if (!raw) return null;
  let value;
  try {
    value = JSON.parse(stripFence(String(raw)));
  } catch {
    return null;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value : null;
  }
  if (value && typeof value === "object") {
    const arrays = Object.values(value).filter(
      (v) => Array.isArray(v) && v.length > 0
    );
    if (arrays.length === 1) return arrays[0];
  }
  return null;
};

// utils/testExerciseRules.ts
var FIELD_LANGUAGES = {
  // Kursant tłumaczy z polskiego na angielski — jedyny typ, w którym
  // polszczyzna w `prompt` jest poprawna i zamierzona.
  translation: { prompt: "pl", correctAnswer: "en" },
  // Tekst z lukami jest materiałem do ćwiczenia, więc po angielsku.
  fill_in_blank: { prompt: "en", correctAnswer: "en" },
  fill_in_blank_bank: { prompt: "en", correctAnswer: "en", wordBank: "en" },
  // Pary słówko–tłumaczenie: jedna strona polska, druga angielska.
  matching: { prompt: "mixed", correctAnswer: "mixed", options: "mixed" },
  // Zdania z błędami do poprawienia — angielski.
  find_mistake: { prompt: "en", correctAnswer: "en" },
  multiple_choice: { prompt: "en", correctAnswer: "en", options: "en" },
  // Polecenie po polsku, wypowiedź kursanta po angielsku.
  writing: { prompt: "mixed", correctAnswer: "en" }
};
var POLISH_LETTERS = /[ąćęłńóśźż]/i;
var POLISH_STOPWORDS = [
  "jest",
  "si\u0119",
  "nie",
  "\u017Ce",
  "aby",
  "oraz",
  "kt\xF3ry",
  "kt\xF3ra",
  "kt\xF3re",
  "dla",
  "przez",
  "jako",
  "tego",
  "tym",
  "tych",
  "jak",
  "ale",
  "czy",
  "gdy",
  "kiedy",
  "poniewa\u017C",
  "dlatego",
  "bardzo",
  "swoje",
  "swoj\u0105",
  "mo\u017Ce",
  "mo\u017Cna",
  "trzeba",
  "zawsze",
  "czasami",
  "cz\u0119sto",
  "wtedy",
  "\u017Ceby",
  "przy",
  "pod",
  "nad",
  "ich"
];
var ENGLISH_STOPWORDS = [
  "the",
  "and",
  "is",
  "are",
  "was",
  "were",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "that",
  "this",
  "it",
  "he",
  "she",
  "they",
  "has",
  "have",
  "had",
  "but",
  "from",
  "not",
  "you",
  "his",
  "her",
  "their",
  "been",
  "will"
];
var POLISH_SUFFIXES = [
  "uje",
  "uj\u0105",
  "ych",
  "ego",
  "emu",
  "ami",
  "cji",
  "\u015Bci",
  "o\u015B\u0107",
  "owy",
  "owa",
  "owe",
  "owa\u0107",
  "kiem",
  "ach",
  "ymi",
  "iej",
  "nej"
];
var MIN_SUFFIX_WORD_LENGTH = 6;
var countPolishSuffixes = (haystack) => haystack.filter(
  (w) => w.length >= MIN_SUFFIX_WORD_LENGTH && POLISH_SUFFIXES.some((suf) => w.endsWith(suf))
).length;
var words = (text) => text.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
var countMatches = (list, haystack) => haystack.filter((w) => list.includes(w)).length;
var detectLanguage = (text) => {
  const clean = String(text || "").trim();
  if (clean.length < 12) return null;
  const w = words(clean);
  if (w.length < 3) return null;
  const pl = countMatches(POLISH_STOPWORDS, w) + countPolishSuffixes(w) + (POLISH_LETTERS.test(clean) ? 2 : 0);
  const en = countMatches(ENGLISH_STOPWORDS, w);
  if (pl === 0 && en === 0) return null;
  return pl > en ? "pl" : "en";
};
var asText = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(" ");
  return "";
};
var validateExerciseLanguage = (question) => {
  if (!question || typeof question !== "object") return [];
  const q = question;
  const type = String(q.type || "");
  const expectations = FIELD_LANGUAGES[type];
  if (!expectations) return [];
  const problems = [];
  for (const [field, expected] of Object.entries(expectations)) {
    if (!expected || expected === "mixed") continue;
    const text = asText(q[field]);
    const found = detectLanguage(text);
    if (!found || found === expected) continue;
    problems.push({
      type,
      field,
      expected,
      found,
      snippet: text.slice(0, 120)
    });
  }
  return problems;
};
var validateTestLanguage = (questions) => (Array.isArray(questions) ? questions : []).flatMap(validateExerciseLanguage);
var describeProblems = (problems) => problems.map(
  (p) => `- typ "${p.type}", pole "${p.field}": ma by\u0107 po ${p.expected === "en" ? "ANGIELSKU" : "POLSKU"}, a jest po ${p.found === "pl" ? "polsku" : "angielsku"}. Fragment: \u201E${p.snippet}"`
).join("\n");
var LANGUAGE_IRON_RULE = `# \u017BELAZNA ZASADA J\u0118ZYKOWA \u2014 WA\u017BNIEJSZA OD WSZYSTKIEGO PONI\u017BEJ

To jest aplikacja do nauki J\u0118ZYKA ANGIELSKIEGO. Materia\u0142, na kt\xF3rym pracuje kursant,
musi by\u0107 PO ANGIELSKU. Prompt jest po polsku i materia\u0142 lekcji jest po polsku \u2014 to NIE
znaczy, \u017Ce \u0107wiczenia maj\u0105 by\u0107 po polsku.

PO POLSKU jest wy\u0142\u0105cznie:
- pole "instruction" (polecenie dla kursanta),
- zdania DO PRZET\u0141UMACZENIA w typie "translation" (kursant t\u0142umaczy PL \u2192 EN),
- polska strona pary w typie "matching",
- opis sytuacji w typie "writing".

PO ANGIELSKU jest WSZYSTKO POZOSTA\u0141E:
- teksty z lukami, historyjki i zdania w "fill_in_blank",
- tekst ORAZ bank s\u0142\xF3w w "fill_in_blank_bank",
- tekst, pytania i opcje odpowiedzi w "multiple_choice",
- zdania z b\u0142\u0119dami i ich poprawne wersje w "find_mistake",
- wszystkie odpowiedzi w "correctAnswer" poza typem "matching".

Tekst z lukami po polsku w te\u015Bcie z angielskiego jest b\u0142\u0119dem dyskwalifikuj\u0105cym
ca\u0142e zadanie. Zanim zwr\xF3cisz wynik, przeczytaj ka\u017Cde zadanie i sprawd\u017A, czy
materia\u0142 do \u0107wiczenia jest po angielsku.`;
var TYPE_RULES = {
  translation: `- translation [zdania PO POLSKU \u2192 t\u0142umaczenie PO ANGIELSKU]: 1 zadanie zbiorcze.
  W 'prompt' umie\u015B\u0107 N zda\u0144 POLSKICH w punktach (1., 2., ...). Do ka\u017Cdego dodaj w nawiasie
  kr\xF3tk\u0105 wskaz\xF3wk\u0119 gramatyczn\u0105, np. (past simple), \u017Ceby kursant wiedzia\u0142, co zastosowa\u0107.
  W 'correctAnswer' umie\u015B\u0107 N t\u0142umacze\u0144 ANGIELSKICH w punktach (1., 2., ...).`,
  fill_in_blank: `- fill_in_blank [tekst PO ANGIELSKU]: 1 zadanie zbiorcze w formie JEDNEGO SP\xD3JNEGO
  TEKSTU ANGIELSKIEGO (kr\xF3tka historyjka lub opis sytuacji). To ma by\u0107 klasyczne \u0107wiczenie
  gramatyczne z podr\u0119cznika: w tek\u015Bcie s\u0105 luki '___', a PRZY KA\u017BDEJ LUCE w nawiasie stoi
  forma bazowa do przekszta\u0142cenia albo wskaz\xF3wka.
  PRZYK\u0141AD POPRAWNEGO 'prompt':
  "Last summer Anna ___ (go) to Italy with her friends. They ___ (stay) in a small hotel
  near the beach and ___ (spend) every morning swimming."
  W 'correctAnswer' umie\u015B\u0107 N poprawnych form w punktach (1. went, 2. stayed, 3. spent).
  Tekst po polsku w tym typie jest b\u0142\u0119dem dyskwalifikuj\u0105cym.`,
  fill_in_blank_bank: `- fill_in_blank_bank [tekst I bank s\u0142\xF3w PO ANGIELSKU]: 1 zadanie zbiorcze
  w formie JEDNEGO SP\xD3JNEGO TEKSTU ANGIELSKIEGO z lukami '___'.
  W 'wordBank' umie\u015B\u0107 ANGIELSKIE s\u0142owa do wstawienia \u2014 dok\u0142adnie te, kt\xF3re pasuj\u0105 do luk.
  W 'correctAnswer' umie\u015B\u0107 N odpowiedzi w punktach.
  KOLEJNO\u015A\u0106 S\u0141\xD3W W 'wordBank' MUSI BY\u0106 LOSOWA I R\xD3\u017BNA OD KOLEJNO\u015ACI LUK \u2014 s\u0142owo do pierwszej
  luki nie mo\u017Ce by\u0107 pierwsze na li\u015Bcie, bo wtedy \u0107wiczenie sprawdza tylko przepisywanie.
  Polskie s\u0142owa w banku s\u0105 b\u0142\u0119dem dyskwalifikuj\u0105cym.`,
  matching: `- matching [pary polsko-angielskie]: 1 zadanie zbiorcze.
  W 'options' zamie\u015B\u0107 list\u0119 N par w formacie ["doje\u017Cd\u017Ca\u0107 = commute", "termin = deadline"].
  Po lewej stronie znaku '=' polskie znaczenie, po prawej angielskie s\u0142owo z lekcji.`,
  find_mistake: `- find_mistake [zdania PO ANGIELSKU]: 1 zadanie zbiorcze polegaj\u0105ce na korekcie b\u0142\u0119d\xF3w.
  W 'prompt' umie\u015B\u0107 N zda\u0144 ANGIELSKICH z celowymi b\u0142\u0119dami w punktach (1., 2., ...).
  RODZAJE B\u0141\u0118D\xD3W DO WYMIESZANIA: gramatyczne, leksykalne, przyimkowe ORAZ OBOWI\u0104ZKOWO B\u0141\u0118DNY
  SZYK ZDANIA \u2014 co najmniej jedno zdanie musi mie\u0107 przestawiony szyk (\u017Ale umiejscowiony
  okolicznik czasu, przys\u0142\xF3wek cz\u0119stotliwo\u015Bci w z\u0142ym miejscu, szyk pytaj\u0105cy w twierdzeniu).
  Do KA\u017BDEGO zdania dodaj na ko\u0144cu w nawiasie wskaz\xF3wk\u0119 po polsku w formacie
  (wskaz\xF3wka: z\u0142y przyimek), (wskaz\xF3wka: 3. osoba l. pojedynczej), (wskaz\xF3wka: z\u0142y szyk zdania).
  W 'correctAnswer' umie\u015B\u0107 N poprawnych zda\u0144 ANGIELSKICH w punktach. Nie wype\u0142niaj 'options'.`,
  multiple_choice: `- multiple_choice [tekst I opcje PO ANGIELSKU]: 1 zadanie zbiorcze.
  W 'prompt' umie\u015B\u0107 JEDEN SP\xD3JNY TEKST ANGIELSKI z lukami '___' albo N angielskich pyta\u0144
  wielokrotnego wyboru. Przy te\u015Bcie z gramatyki preferowana jest kr\xF3tka historyjka.
  W 'options' podaj ANGIELSKIE opcje A/B/C.
  ROZ\u0141\xD3\u017B POPRAWNE ODPOWIEDZI R\xD3WNOMIERNIE MI\u0118DZY A, B i C \u2014 poprawna odpowied\u017A nie mo\u017Ce stale
  wypada\u0107 jako pierwsza, bo kursant rozwi\u0105\u017Ce zadanie bez czytania opcji.
  DYSTRAKTORY to typowe b\u0142\u0119dy Polaka ucz\u0105cego si\u0119 angielskiego: kalka z polskiego, mylony czas,
  z\u0142y przyimek. Opcje absurdalne niczego nie sprawdzaj\u0105 i s\u0105 zabronione.`,
  writing: `- writing [polecenie po polsku, wypowied\u017A kursanta PO ANGIELSKU]: 1 zadanie otwarte.
  W 'prompt' opisz po polsku sytuacj\u0119 i wska\u017C, czego wypowied\u017A ma dotyczy\u0107, podaj oczekiwan\u0105
  d\u0142ugo\u015B\u0107 (np. 60\u201380 s\u0142\xF3w) oraz WYMIE\u0143 KONKRETNE konstrukcje lub s\u0142ownictwo z lekcji, kt\xF3rych
  kursant ma u\u017Cy\u0107. W 'correctAnswer' umie\u015B\u0107 przyk\u0142adow\u0105 wypowied\u017A wzorcow\u0105 PO ANGIELSKU.`
};
var rulesForTypes = (types) => types.map((t) => TYPE_RULES[t]).filter(Boolean).join("\n\n   ");

// server.ts
var import_firebase_applet_config = __toESM(require_firebase_applet_config(), 1);
import express from "express";
import path from "path";
import fs from "fs";
import { initializeApp as initializeApp2, cert, getApps as getApps2, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore as getFirestore2 } from "firebase-admin/firestore";
import { createHmac, randomUUID as randomUUID2 } from "crypto";
import { GoogleGenAI, Type } from "@google/genai";

// services/aiModels.ts
var PRIMARY_MODEL = "gemini-2.5-flash";
var SECONDARY_MODEL = "gemini-3.8-flash";
var TERTIARY_MODEL = "openai/gpt-4o-mini";
var QUATERNARY_MODEL = "openai/gpt-5.6-luna";
var AI_MODEL_CASCADE = [
  PRIMARY_MODEL,
  SECONDARY_MODEL,
  TERTIARY_MODEL,
  QUATERNARY_MODEL
];
var OPENAI_MODEL_CASCADE = AI_MODEL_CASCADE.filter(
  (m) => m.startsWith("openai/")
).map((m) => m.replace("openai/", ""));
var GEMINI_MODEL_CASCADE = AI_MODEL_CASCADE.filter(
  (m) => m.startsWith("gemini")
);
var openAiModelsFor = (requestedModel) => {
  const requested = requestedModel ? String(requestedModel).replace("openai/", "").trim() : "";
  return Array.from(new Set([requested, ...OPENAI_MODEL_CASCADE].filter(Boolean)));
};

// utils/lessonImport.ts
var asText2 = (value) => typeof value === "string" ? value : value == null ? "" : String(value);
function normalizeLessonDate(value, today) {
  const text = asText2(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmy = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (text && !isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return today;
}
function normalizeImportedLessons(payload, options) {
  const { today, fallbackStudentId = "" } = options;
  const raw = Array.isArray(payload?.lessons) ? payload.lessons : Array.isArray(payload) ? payload : [];
  return raw.filter((lesson) => lesson && typeof lesson === "object").map((lesson) => ({
    date: normalizeLessonDate(lesson.date, today),
    studentId: asText2(lesson.studentId) || fallbackStudentId,
    studentIds: Array.isArray(lesson.studentIds) ? lesson.studentIds.map(asText2).filter(Boolean) : [],
    lessonTopic: asText2(lesson.lessonTopic).trim(),
    revisionNotes: asText2(lesson.revisionNotes),
    vocabularyText: asText2(lesson.vocabularyText),
    studentSpeaking: asText2(lesson.studentSpeaking),
    thingsToImprove: asText2(lesson.thingsToImprove),
    suggestedFollowUp: asText2(lesson.suggestedFollowUp)
  })).filter(
    (lesson) => lesson.lessonTopic || lesson.revisionNotes.trim() || lesson.vocabularyText.trim()
  );
}

// utils/studentImportNormalize.ts
var asText3 = (value) => typeof value === "string" ? value : value == null ? "" : String(value);
var asStringArray = (value) => Array.isArray(value) ? value.map(asText3).map((s) => s.trim()).filter(Boolean) : [];
var CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
var asCefrLevel = (value) => {
  const text = asText3(value).trim().toUpperCase();
  return CEFR_LEVELS.includes(text) ? text : void 0;
};
var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeLessonImportDate(rawDate, today) {
  const text = asText3(rawDate).trim();
  if (!text) return { date: today, ambiguous: true };
  const hasFourDigitYear = /\b\d{4}\b/.test(text);
  const normalized = normalizeLessonDate(text, today);
  return { date: normalized, ambiguous: !hasFourDigitYear };
}
function normalizeParsedLessons(payload, today) {
  const raw = Array.isArray(payload) ? payload : [];
  return raw.filter((lesson) => lesson && typeof lesson === "object").map((lesson) => {
    const { date, ambiguous } = normalizeLessonImportDate(lesson.date, today);
    return {
      date,
      dateAmbiguous: Boolean(lesson.dateAmbiguous) || ambiguous,
      summary: asText3(lesson.summary).trim(),
      vocabulary: asStringArray(lesson.vocabulary),
      corrections: asStringArray(lesson.corrections)
    };
  }).filter(
    (lesson) => lesson.summary || lesson.vocabulary.length > 0 || lesson.corrections.length > 0
  );
}
function normalizeStudentImportAnalysis(payload, today) {
  const raw = payload && typeof payload === "object" ? payload : {};
  const rawExtracted = raw.extractedData && typeof raw.extractedData === "object" ? raw.extractedData : {};
  const fullName = asText3(rawExtracted.fullName).trim() || void 0;
  const emailCandidate = asText3(rawExtracted.email).trim().toLowerCase();
  const email = EMAIL_REGEX.test(emailCandidate) ? emailCandidate : void 0;
  const level = asCefrLevel(rawExtracted.level);
  const historicalLessons = normalizeParsedLessons(rawExtracted.historicalLessons, today);
  const missingFields = [];
  if (!fullName) {
    missingFields.push({ field: "fullName", label: "Imi\u0119 i nazwisko kursanta", severity: "critical" });
  }
  if (!email) {
    missingFields.push({ field: "email", label: "Adres e-mail kursanta", severity: "critical" });
  }
  if (!level) {
    missingFields.push({ field: "level", label: "Poziom zaawansowania (CEFR)", severity: "warning" });
  }
  if (historicalLessons.some((l) => l.dateAmbiguous)) {
    missingFields.push({ field: "lessonDates", label: "Niepewne daty lekcji do weryfikacji", severity: "warning" });
  }
  const hasCritical = missingFields.some((f) => f.severity === "critical");
  return {
    status: hasCritical ? "NEEDS_REVIEW" : "READY",
    extractedData: {
      fullName,
      email,
      level,
      targetGoals: asText3(rawExtracted.targetGoals).trim() || void 0,
      industry: asText3(rawExtracted.industry).trim() || void 0,
      generalNotes: asText3(rawExtracted.generalNotes).trim() || void 0,
      historicalLessons
    },
    missingFields,
    aiComment: asText3(raw.aiComment).trim() || "Model nie doda\u0142 podsumowania."
  };
}

// types/scenario.ts
var SCENARIO_MODULE_IDS = [
  "warmup_followup",
  "error_work",
  "main_topic",
  "wrapup_feedback"
];
var SCENARIO_DURATION_BUDGETS = {
  45: {
    warmup_followup: 5,
    error_work: 10,
    main_topic: 25,
    wrapup_feedback: 5
  },
  60: {
    warmup_followup: 8,
    error_work: 12,
    main_topic: 32,
    wrapup_feedback: 8
  },
  90: {
    warmup_followup: 10,
    error_work: 18,
    main_topic: 50,
    wrapup_feedback: 12
  }
};

// utils/scenarioValidation.ts
function validateScenarioModelOutput(parsed) {
  if (!parsed || !Array.isArray(parsed.modules) || parsed.modules.length !== 4) {
    throw new Error("Model zwr\xF3ci\u0142 nieprawid\u0142ow\u0105 liczb\u0119 modu\u0142\xF3w scenariusza.");
  }
  for (let i = 0; i < SCENARIO_MODULE_IDS.length; i++) {
    const expectedId = SCENARIO_MODULE_IDS[i];
    const mod = parsed.modules[i];
    if (!mod || mod.moduleId !== expectedId) {
      throw new Error(`Nieprawid\u0142owa kolejno\u015B\u0107 lub identyfikator modu\u0142u na pozycji ${i}: oczekiwano "${expectedId}".`);
    }
    if (!mod.objective || !String(mod.objective).trim()) {
      throw new Error(`Modu\u0142 "${expectedId}" nie ma celu (objective).`);
    }
    if (!Array.isArray(mod.items) || mod.items.length < 1 || mod.items.length > 6) {
      throw new Error(`Modu\u0142 "${expectedId}" musi mie\u0107 od 1 do 6 punkt\xF3w.`);
    }
    for (const item of mod.items) {
      if (!item?.text || !String(item.text).trim()) {
        throw new Error(`Modu\u0142 "${expectedId}" zawiera pusty punkt.`);
      }
    }
    if (expectedId === "main_topic") {
      if (!Array.isArray(mod.teacherNotes) || mod.teacherNotes.length < 1) {
        throw new Error('Modu\u0142 "main_topic" musi mie\u0107 co najmniej jedn\u0105 wskaz\xF3wk\u0119 ratunkow\u0105 (teacherNotes).');
      }
      for (const note of mod.teacherNotes) {
        if (!note || !String(note).trim()) {
          throw new Error('Modu\u0142 "main_topic" zawiera pust\u0105 wskaz\xF3wk\u0119 ratunkow\u0105 (teacherNotes).');
        }
      }
    } else if (mod.teacherNotes !== void 0 && !Array.isArray(mod.teacherNotes)) {
      throw new Error(`Modu\u0142 "${expectedId}" ma nieprawid\u0142owy format teacherNotes.`);
    }
  }
}
function buildLessonScenario(parsed, opts, makeId) {
  const budgets = SCENARIO_DURATION_BUDGETS[opts.durationMin];
  const modules = parsed.modules.map((mod) => ({
    moduleId: mod.moduleId,
    objective: mod.objective.trim(),
    durationMin: budgets[mod.moduleId],
    items: mod.items.map((item) => ({
      id: makeId(),
      text: item.text.trim()
    })),
    ...mod.teacherNotes ? { teacherNotes: mod.teacherNotes.map((note) => note.trim()) } : {}
  }));
  return {
    id: makeId(),
    studentId: opts.studentId,
    durationMin: opts.durationMin,
    mode: opts.mode,
    modules,
    generatedAt: opts.generatedAt
  };
}

// utils/exerciseShuffle.ts
function shuffleArray(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function shuffleDistinct(items, random = Math.random) {
  if (items.length < 2) return [...items];
  const allIdentical = items.every((item) => item === items[0]);
  if (allIdentical) return [...items];
  const isSameOrder = (candidate) => candidate.every((item, index) => item === items[index]);
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = shuffleArray(items, random);
    if (!isSameOrder(candidate)) return candidate;
  }
  const fallback = [...items];
  for (let i = 0; i < fallback.length - 1; i++) {
    if (fallback[i] !== fallback[i + 1]) {
      [fallback[i], fallback[i + 1]] = [fallback[i + 1], fallback[i]];
      break;
    }
  }
  return fallback;
}

// functions/src/homeworkV2/contracts.ts
var ENGINE_VERSION = 2;
var SCHEMA_VERSION = "2.0.0";
var PROMPT_VERSION = "hw-v2-2026-09-12";
var EXERCISE_TYPES_V2 = [
  "micro_translation",
  "fix_sentence",
  "gap_from_context"
];
var MAX_REGENERATIONS = 2;
var MAX_LESSONS_AS_FUEL = 3;
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
var isExerciseTypeV2 = (value) => typeof value === "string" && EXERCISE_TYPES_V2.includes(value);
var isSourceRefV2 = (value) => {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return candidate.kind === "lessonRecord" && isNonEmptyString(candidate.id);
};
var isValidationResultV2 = (value) => {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return typeof candidate.passed === "boolean" && typeof candidate.score === "number" && candidate.score >= 0 && candidate.score <= 1 && isStringArray(candidate.failedChecks) && typeof candidate.regenerationCount === "number" && candidate.regenerationCount >= 0 && candidate.regenerationCount <= MAX_REGENERATIONS && isNonEmptyString(candidate.modelVersion) && isNonEmptyString(candidate.checkedAt);
};
var isExerciseContractV2 = (value) => {
  if (!value || typeof value !== "object") return false;
  const c = value;
  const hasExactlyOneAudience = (isNonEmptyString(c.studentId) ? 1 : 0) + (isNonEmptyString(c.groupId) ? 1 : 0) === 1;
  return isNonEmptyString(c.id) && c.engineVersion === ENGINE_VERSION && isNonEmptyString(c.schemaVersion) && isNonEmptyString(c.promptVersion) && isNonEmptyString(c.modelVersion) && isNonEmptyString(c.teacherId) && hasExactlyOneAudience && c.mode === "training" && isExerciseTypeV2(c.exerciseType) && c.responseMode === "text" && isNonEmptyString(c.sourceLanguage) && isNonEmptyString(c.targetLanguage) && isNonEmptyString(c.cefr) && typeof c.difficulty === "number" && c.difficulty >= 1 && c.difficulty <= 5 && isNonEmptyString(c.learningObjective) && isNonEmptyString(c.content) && isNonEmptyString(c.instruction) && isNonEmptyString(c.modelAnswer) && isStringArray(c.acceptedVariants) && isStringArray(c.requiredMaterial) && c.requiredMaterial.length > 0 && isStringArray(c.commonMistakes) && isNonEmptyString(c.hintSmall) && isNonEmptyString(c.hintLarge) && Array.isArray(c.sourceRefs) && c.sourceRefs.length > 0 && c.sourceRefs.every(isSourceRefV2) && isValidationResultV2(c.validation) && typeof c.requiresTeacherReview === "boolean" && isNonEmptyString(c.createdAt);
};

// functions/src/homeworkV2/db.ts
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// functions/src/config.ts
var DATABASE_ID = "ai-studio-520a4841-33d0-41ef-829a-838ebc44072d";

// functions/src/homeworkV2/db.ts
var cached = null;
var getDb = () => {
  if (!cached) {
    if (getApps().length === 0) initializeApp();
    cached = getFirestore(DATABASE_ID);
  }
  return cached;
};

// functions/src/homeworkV2/contextAssembler.ts
var PRONUNCIATION_MARKERS = /(wymow|pronunc|akcent|stress|intonac|intonat|sylab|syllab|\/[a-zʃʒθðŋæɪʊəɜɑɒʌ:ˈˌ]+\/|\[[a-zʃʒθðŋæɪʊəɜɑɒʌ:ˈˌ]+\])/i;
var stripPronunciationLines = (corrections) => (corrections || "").split("\n").filter((line) => line.trim().length > 0 && !PRONUNCIATION_MARKERS.test(line)).join("\n").trim();
var readLessonFuel = (lessonId, record) => {
  const blocks = record.structuredBlocks || {};
  const text = (blockValue, flatValue) => String(blockValue || flatValue || "").trim();
  return {
    lessonId,
    topic: String(record.topic || "").trim(),
    date: String(record.date || "").trim(),
    vocabulary: text(blocks.vocabulary, record.vocabularyText),
    corrections: stripPronunciationLines(text(blocks.corrections, record.corrections)),
    summary: text(blocks.summary, record.lessonSummary),
    goals: text(blocks.nextLesson, record.nextLessonPlan || record.suggestedFollowUp)
  };
};
var isApprovedLesson = (record) => {
  if (record.status === "rejected" || record.status === "pending_confirmation") return false;
  if (record.isPendingConfirmation === true) return false;
  if (record.isDateMissing === true) return false;
  const reason = String(record.pendingReason || "").trim();
  return reason.length === 0;
};
var hasUsableFuel = (fuel) => fuel.vocabulary.length > 0 || fuel.corrections.length > 0;
var assembleContext = async (input) => {
  const ids = input.lessonIds.slice(0, MAX_LESSONS_AS_FUEL);
  if (ids.length === 0) throw new Error("Nie wskazano \u017Cadnej lekcji jako paliwa.");
  const lessons = [];
  const rejected = [];
  if (Array.isArray(input.rawLessons) && input.rawLessons.length > 0) {
    input.rawLessons.forEach((record) => {
      const id = String(record.id || record.lessonId || "");
      if (!isApprovedLesson(record)) {
        rejected.push(`${id}: lekcja niezatwierdzona`);
        return;
      }
      const fuel = readLessonFuel(id, record);
      if (!hasUsableFuel(fuel)) {
        rejected.push(`${id}: brak s\u0142ownictwa i korekt`);
        return;
      }
      lessons.push(fuel);
    });
  } else {
    const snapshots = await Promise.all(
      ids.map((id) => getDb().collection("users").doc(input.studentUid).collection("lessonRecords").doc(id).get())
    );
    snapshots.forEach((snapshot, index) => {
      const id = ids[index];
      if (!snapshot.exists) {
        rejected.push(`${id}: lekcja nie istnieje`);
        return;
      }
      const record = snapshot.data();
      if (!isApprovedLesson(record)) {
        rejected.push(`${id}: lekcja niezatwierdzona`);
        return;
      }
      const fuel = readLessonFuel(id, record);
      if (!hasUsableFuel(fuel)) {
        rejected.push(`${id}: brak s\u0142ownictwa i korekt`);
        return;
      }
      lessons.push(fuel);
    });
  }
  if (lessons.length === 0) {
    throw new Error(
      `\u017Badna z wybranych lekcji nie nadaje si\u0119 na paliwo. ${rejected.join("; ")}`
    );
  }
  return {
    lessons,
    student: {
      cefr: input.cefr,
      // Przycięte: model ma wiedzieć, co wraca, a nie dostać całą historię.
      recentMistakes: (input.recentMistakes || []).slice(0, 8)
    },
    lessonIds: lessons.map((lesson) => lesson.lessonId)
  };
};
var renderContextForPrompt = (context) => {
  const lessonSections = context.lessons.map((lesson, index) => {
    const parts = [`### LEKCJA ${index + 1}: ${lesson.topic || "(bez tematu)"} (${lesson.date})`];
    if (lesson.summary) parts.push(`NOTATKA LEKTORA:
${lesson.summary}`);
    if (lesson.vocabulary) parts.push(`S\u0141OWNICTWO:
${lesson.vocabulary}`);
    if (lesson.corrections) parts.push(`KOREKTY J\u0118ZYKOWE:
${lesson.corrections}`);
    if (lesson.goals) parts.push(`CELE NA DALEJ:
${lesson.goals}`);
    return parts.join("\n\n");
  });
  const mistakes = context.student.recentMistakes.length ? `

### POWTARZAJ\u0104CE SI\u0118 B\u0141\u0118DY KURSANTA
${context.student.recentMistakes.map((m) => `- ${m}`).join("\n")}` : "";
  return `### KURSANT
Poziom: ${context.student.cefr}
(Kursant jest anonimowy. Nie u\u017Cywaj imion ani fakt\xF3w osobistych \u2014 nie masz ich i nie wolno Ci ich wymy\u015Bla\u0107.)

${lessonSections.join("\n\n")}${mistakes}`;
};

// functions/src/homeworkV2/exercisePlanner.ts
var MINUTES_PER_TYPE = {
  micro_translation: 3,
  fix_sentence: 2,
  gap_from_context: 1.5
};
var difficultyForCefr = (cefr) => {
  const level = String(cefr || "").trim().toUpperCase();
  if (level.startsWith("A1")) return 1;
  if (level.startsWith("A2")) return 2;
  if (level.startsWith("B1")) return 3;
  if (level.startsWith("B2")) return 4;
  if (level.startsWith("C")) return 5;
  return 3;
};
var planExercises = (input) => {
  const warnings = [];
  const types = input.requestedTypes && input.requestedTypes.length > 0 ? input.requestedTypes.filter((t) => EXERCISE_TYPES_V2.includes(t)) : [...EXERCISE_TYPES_V2];
  if (types.length === 0) {
    throw new Error("Nie wybrano \u017Cadnego typu zadania obj\u0119tego silnikiem v2.");
  }
  const itemCount = Math.max(1, Math.floor(input.itemCount));
  const baseDifficulty = difficultyForCefr(input.context.student.cefr);
  const slots = Array.from({ length: itemCount }, (_, index) => ({
    exerciseType: types[index % types.length],
    difficulty: baseDifficulty
  }));
  const estimatedMinutes = slots.reduce((sum, slot) => sum + MINUTES_PER_TYPE[slot.exerciseType], 0);
  if (input.plannedMinutes && input.plannedMinutes > 0) {
    const ratio = estimatedMinutes / input.plannedMinutes;
    if (ratio > 1.5) {
      warnings.push(
        `${itemCount} zada\u0144 to oko\u0142o ${Math.round(estimatedMinutes)} min pracy, a zaplanowano ${input.plannedMinutes} min. Kursant prawdopodobnie nie sko\u0144czy w za\u0142o\u017Conym czasie.`
      );
    } else if (ratio < 0.5) {
      warnings.push(
        `${itemCount} zada\u0144 to oko\u0142o ${Math.round(estimatedMinutes)} min pracy przy zaplanowanych ${input.plannedMinutes} min. Zestaw mo\u017Ce by\u0107 za kr\xF3tki na t\u0119 lekcj\u0119.`
      );
    }
  }
  const vocabularyLines = input.context.lessons.reduce(
    (sum, lesson) => sum + lesson.vocabulary.split("\n").filter((l) => l.trim()).length,
    0
  );
  const correctionLines = input.context.lessons.reduce(
    (sum, lesson) => sum + lesson.corrections.split("\n").filter((l) => l.trim()).length,
    0
  );
  const availableMaterial = vocabularyLines + correctionLines;
  if (availableMaterial > 0 && itemCount > availableMaterial) {
    warnings.push(
      `Zam\xF3wiono ${itemCount} zada\u0144, a w wybranych lekcjach jest ${availableMaterial} pozycji materia\u0142u. Cz\u0119\u015B\u0107 zada\u0144 b\u0119dzie powtarza\u0107 ten sam cel.`
    );
  }
  if (types.includes("fix_sentence") && correctionLines === 0) {
    warnings.push(
      'Wybrano \u201ENapraw zdanie", ale w lekcjach nie ma bloku korekt. B\u0142\u0119dy powstan\u0105 z typowych pomy\u0142ek na tym poziomie, a nie z realnych pomy\u0142ek kursanta.'
    );
  }
  return { slots, warnings };
};

// functions/src/homeworkV2/exerciseGenerator.ts
import { randomUUID } from "crypto";

// functions/src/homeworkV2/coreKnowledge.ts
var ASSISTANT_IDENTITY = `Jeste\u015B Asystentem Cribro \u2014 cz\u0119\u015Bci\u0105 platformy do nauki angielskiego,
w kt\xF3rej lektor pracuje z konkretnymi kursantami.

Nie podszywasz si\u0119 pod lektora. Nigdy nie twierdzisz, \u017Ce Maciej osobi\u015Bcie sprawdzi\u0142 odpowied\u017A.
Jeste\u015B spokojny, konkretny, ludzki, cierpliwy i wspieraj\u0105cy.
Nie cukrujesz, ale zawsze zauwa\u017Casz prawdziwy element post\u0119pu.
Wynik traktujesz jako informacj\u0119 o etapie nauki, nie ocen\u0119 cz\u0142owieka.`;
var NATURALNESS_RULES = `ZASADY NATURALNO\u015ACI:
1. Zdanie ma brzmie\u0107 jak wypowied\u017A \u017Cywego cz\u0142owieka w konkretnej sytuacji, nie jak przyk\u0142ad z podr\u0119cznika.
2. Polska wersja musi by\u0107 naturaln\u0105 polszczyzn\u0105, a nie kalk\u0105 z angielskiego.
3. Angielska wersja musi by\u0107 naturaln\u0105 angielszczyzn\u0105, a nie kalk\u0105 z polskiego.
4. Kontekst ma by\u0107 zwyczajny i ludzki: praca, dom, plany, zm\u0119czenie, jedzenie, dojazdy, znajomi.
5. S\u0142ownictwo wspieraj\u0105ce musi by\u0107 PROSTSZE ni\u017C cel \u0107wiczenia. Zadanie sprawdza jedn\u0105 rzecz,
   a nie odporno\u015B\u0107 kursanta na nieznane s\u0142owa obok.
6. Jedno zadanie = jeden g\u0142\xF3wny cel j\u0119zykowy.
7. Polecenie i klucz musz\u0105 by\u0107 jednoznaczne. Je\u015Bli da si\u0119 odpowiedzie\u0107 poprawnie na dwa sposoby,
   oba musz\u0105 by\u0107 w wariantach akceptowanych.`;
var ANTI_PATTERNS = `ANTYWZORCE \u2014 tego nie wolno produkowa\u0107:
- Zdania-wydmuszki bez sytuacji: \u201EThe man is tall.", \u201EShe has a book."
- Konteksty rodem z podr\u0119cznika lat 90.: pi\xF3ra, ciotki, ogrodnicy.
- Zdania, w kt\xF3rych \u0107wiczona konstrukcja jest ozdob\u0105, a nie konieczno\u015Bci\u0105.
- S\u0142ownictwo wspieraj\u0105ce trudniejsze od celu.
- Dwa cele gramatyczne naraz (\u201Eu\u017Cywaj\u0105c strony biernej ORAZ trybu warunkowego").
- Polecenia, z kt\xF3rych nie wynika, czego si\u0119 oczekuje.
- Zdania zale\u017Cne od wiedzy o kursancie, kt\xF3rej nie ma w materiale lekcji.
- Fakty wymy\u015Blone o kursancie: imiona, miejsca, praca, rodzina \u2014 je\u015Bli nie ma ich
  w zatwierdzonym materiale, nie wolno ich u\u017Cy\u0107.`;
var EXERCISE_TYPE_BRIEFS = {
  micro_translation: `T\u0141UMACZENIE MIKRO-KONTEKSTU (micro_translation)
Kursant t\u0142umaczy jedno polskie zdanie na angielski, u\u017Cywaj\u0105c materia\u0142u z lekcji.
- \`content\`: polskie zdanie do przet\u0142umaczenia.
- \`modelAnswer\`: wzorcowe t\u0142umaczenie angielskie.
- \`acceptedVariants\`: inne naturalne t\u0142umaczenia, kt\xF3re zas\u0142uguj\u0105 na pe\u0142ne punkty.
- \`requiredMaterial\`: konstrukcja lub s\u0142owa z lekcji, kt\xF3re MUSZ\u0104 si\u0119 pojawi\u0107.
- \`hintSmall\`: pierwsze s\u0142owo lub konstrukcja, od kt\xF3rej zaczyna si\u0119 zdanie.
- \`hintLarge\`: szkielet zdania z lukami.`,
  fix_sentence: `NAPRAW ZDANIE (fix_sentence)
Kursant przepisuje ca\u0142e zdanie, poprawiaj\u0105c zawarty w nim b\u0142\u0105d.
- \`content\`: zdanie angielskie z JEDNYM b\u0142\u0119dem \u2014 typowym, nie wymy\u015Blonym.
- \`modelAnswer\`: pe\u0142ne poprawne zdanie (nie samo wskazanie b\u0142\u0119du).
- \`acceptedVariants\`: inne poprawne wersje tego zdania.
- \`requiredMaterial\`: mechanizm j\u0119zykowy, kt\xF3rego dotyczy b\u0142\u0105d.
- \`hintSmall\`: wskazanie MIEJSCA b\u0142\u0119du, bez nazywania go.
- \`hintLarge\`: nazwa typu b\u0142\u0119du (np. \u201Ez\u0142y czas"), nadal bez pe\u0142nej poprawki.`,
  gap_from_context: `UZUPE\u0141NIJ Z KONTEKSTU (gap_from_context)
Kursant sam wpisuje brakuj\u0105ce s\u0142owo lub fraz\u0119. Bez banku s\u0142\xF3w.
- \`content\`: zdanie angielskie z luk\u0105 oznaczon\u0105 jako \`___\`.
- \`modelAnswer\`: s\u0142owo lub fraza, kt\xF3ra wchodzi w luk\u0119.
- \`acceptedVariants\`: inne trafne uzupe\u0142nienia.
- \`requiredMaterial\`: s\u0142owo lub konstrukcja z lekcji.
- \`hintSmall\`: pierwsza litera brakuj\u0105cego s\u0142owa.
- \`hintLarge\`: liczba s\u0142\xF3w albo fragment odpowiedzi.
Kontekst musi by\u0107 na tyle jednoznaczny, \u017Ceby pasowa\u0142o dok\u0142adnie jedno sensowne uzupe\u0142nienie.`
};
var VALIDATOR_CHECKS = `SPRAWD\u0179 KA\u017BDE ZADANIE, ODPOWIADAJ\u0104C NA DZIESI\u0118\u0106 PYTA\u0143:
1. grounding \u2014 czy zadanie wynika z podanego materia\u0142u lekcji?
2. naturalness_pl \u2014 czy polska wersja brzmi naturalnie?
3. naturalness_en \u2014 czy angielska wersja brzmi naturalnie?
4. meaning_match \u2014 czy znaczenie, czas, osoba, liczba i modalno\u015B\u0107 si\u0119 zgadzaj\u0105?
5. level_fit \u2014 czy poziom odpowiada mo\u017Cliwo\u015Bciom kursanta?
6. single_goal \u2014 czy zadanie ma dok\u0142adnie jeden g\u0142\xF3wny cel?
7. unambiguous \u2014 czy polecenie i klucz s\u0105 jednoznaczne?
8. variants_covered \u2014 czy uwzgl\u0119dniono naturalne odpowiedzi alternatywne?
9. no_invented_facts \u2014 czy nie u\u017Cyto wymy\u015Blonego faktu o kursancie?
10. supporting_simpler \u2014 czy s\u0142ownictwo wspieraj\u0105ce jest prostsze od celu?

Zadanie przechodzi, gdy \u017Cadne z pyta\u0144 nie wypada \u017Ale.
B\u0105d\u017A surowy. Przepuszczone s\u0142abe zadanie kosztuje czas kursanta i zaufanie lektora.`;
var buildCoreSystemPrompt = () => [ASSISTANT_IDENTITY, NATURALNESS_RULES, ANTI_PATTERNS].join("\n\n");

// functions/src/homeworkV2/exerciseGenerator.ts
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var asStringArray2 = (value) => Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim().length > 0) : [];
var parseDraft = (raw, fallbackType) => {
  if (!raw || typeof raw !== "object") return null;
  const d = raw;
  if (!isNonEmptyString2(d.content)) return null;
  if (!isNonEmptyString2(d.modelAnswer)) return null;
  if (!isNonEmptyString2(d.learningObjective)) return null;
  const requiredMaterial = asStringArray2(d.requiredMaterial);
  if (requiredMaterial.length === 0) return null;
  return {
    exerciseType: isNonEmptyString2(d.exerciseType) ? d.exerciseType : fallbackType,
    learningObjective: String(d.learningObjective).trim(),
    content: String(d.content).trim(),
    instruction: isNonEmptyString2(d.instruction) ? String(d.instruction).trim() : "",
    modelAnswer: String(d.modelAnswer).trim(),
    acceptedVariants: asStringArray2(d.acceptedVariants),
    requiredMaterial,
    commonMistakes: asStringArray2(d.commonMistakes),
    hintSmall: isNonEmptyString2(d.hintSmall) ? String(d.hintSmall).trim() : "",
    hintLarge: isNonEmptyString2(d.hintLarge) ? String(d.hintLarge).trim() : "",
    sourceLessonIndex: typeof d.sourceLessonIndex === "number" ? d.sourceLessonIndex : 1
  };
};
var buildGeneratorPrompt = (context, slots) => {
  const typeBriefs = Array.from(new Set(slots.map((s) => s.exerciseType))).map((type) => EXERCISE_TYPE_BRIEFS[type]).join("\n\n");
  const order = slots.map((slot, index) => `${index + 1}. ${slot.exerciseType} (trudno\u015B\u0107 ${slot.difficulty}/5)`).join("\n");
  return `${renderContextForPrompt(context)}

---

${typeBriefs}

---

ZAM\xD3WIENIE \u2014 u\u0142\xF3\u017C dok\u0142adnie ${slots.length} zada\u0144, w tej kolejno\u015Bci i tych typach:
${order}

TWARDE ZASADY:
- Ka\u017Cde zadanie MUSI wynika\u0107 z materia\u0142u powy\u017Cej. Nie wolno wprowadza\u0107 nowego celu nauki.
- Ka\u017Cde zadanie ma DOK\u0141ADNIE JEDEN g\u0142\xF3wny cel w polu \`learningObjective\`.
- \`requiredMaterial\` to konkretne s\u0142owa lub konstrukcje z lekcji, kt\xF3rych odpowied\u017A musi u\u017Cy\u0107.
- \`acceptedVariants\` musi zawiera\u0107 realne, naturalne alternatywy. Pusta tablica tylko wtedy,
  gdy odpowied\u017A jest naprawd\u0119 jedna.
- \`hintSmall\` i \`hintLarge\` uk\u0142adasz zgodnie z opisem typu. To one b\u0119d\u0105 pokazane
  przy pr\xF3bie 2 i 3 \u2014 nie wolno w nich zdradzi\u0107 ca\u0142ej odpowiedzi.
- \`sourceLessonIndex\` to numer lekcji (1, 2 lub 3), z kt\xF3rej wzi\u0119ty jest materia\u0142.
- Nie powtarzaj tego samego celu w dw\xF3ch zadaniach, je\u015Bli materia\u0142u starcza na r\xF3\u017Cne.

FORMAT ODPOWIEDZI \u2014 obiekt JSON z jednym kluczem \`exercises\`, tablic\u0105 ${slots.length} obiekt\xF3w:
{
  "exercises": [
    {
      "exerciseType": "micro_translation",
      "learningObjective": "kr\xF3tki opis jednego celu",
      "content": "tre\u015B\u0107 zadania",
      "instruction": "polecenie dla kursanta po polsku",
      "modelAnswer": "odpowied\u017A wzorcowa",
      "acceptedVariants": ["inna naturalna wersja"],
      "requiredMaterial": ["konstrukcja z lekcji"],
      "commonMistakes": ["typowy b\u0142\u0105d przy tym zadaniu"],
      "hintSmall": "podpowied\u017A do pr\xF3by 2",
      "hintLarge": "podpowied\u017A do pr\xF3by 3",
      "sourceLessonIndex": 1
    }
  ]
}`;
};
var generateExercises = async (input) => {
  const response = await input.call({
    system: `${buildCoreSystemPrompt()}

Twoje zadanie: u\u0142o\u017Cy\u0107 \u0107wiczenia na podstawie materia\u0142u z odbytej lekcji.
Pracujesz wy\u0142\u0105cznie na podanym materiale. Nie dodajesz nowych cel\xF3w nauki.`,
    user: buildGeneratorPrompt(input.context, input.slots),
    taskName: "hw-v2/generate",
    // Wyżej niż domyślna: zdania mają brzmieć żywo, a nie jak wariacje
    // jednego szablonu. Kontrolę nad sensem trzyma walidator, nie temperatura.
    temperature: 0.6
  });
  const payload = response.data;
  const rawList = Array.isArray(payload?.exercises) ? payload.exercises : [];
  const drafts = [];
  rawList.forEach((raw, index) => {
    const fallbackType = input.slots[index]?.exerciseType || input.slots[0].exerciseType;
    const draft = parseDraft(raw, fallbackType);
    if (draft) drafts.push(draft);
  });
  return {
    drafts,
    modelUsed: response.modelUsed,
    missingSlots: Math.max(0, input.slots.length - drafts.length)
  };
};
var finalizeContract = (input) => {
  const { draft, context } = input;
  const lessonIndex = Math.min(Math.max(1, draft.sourceLessonIndex), context.lessons.length) - 1;
  const lesson = context.lessons[lessonIndex] || context.lessons[0];
  return {
    id: randomUUID(),
    engineVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
    modelVersion: input.modelVersion,
    teacherId: input.teacherId,
    ...input.studentId ? { studentId: input.studentId } : {},
    ...input.groupId ? { groupId: input.groupId } : {},
    mode: "training",
    exerciseType: draft.exerciseType,
    responseMode: "text",
    sourceLanguage: "pl",
    targetLanguage: "en",
    cefr: context.student.cefr,
    difficulty: input.slot.difficulty,
    learningObjective: draft.learningObjective,
    content: draft.content,
    instruction: draft.instruction || defaultInstruction(draft.exerciseType),
    modelAnswer: draft.modelAnswer,
    acceptedVariants: draft.acceptedVariants,
    requiredMaterial: draft.requiredMaterial,
    commonMistakes: draft.commonMistakes,
    hintSmall: draft.hintSmall || defaultHint(draft.exerciseType, "small"),
    hintLarge: draft.hintLarge || defaultHint(draft.exerciseType, "large"),
    sourceRefs: [
      {
        kind: "lessonRecord",
        id: lesson.lessonId,
        block: "vocabulary",
        label: "lekcja"
      }
    ],
    validation: input.validation,
    requiresTeacherReview: input.requiresTeacherReview,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
};
var defaultInstruction = (type) => {
  if (type === "micro_translation") return "Przet\u0142umacz zdanie na angielski, u\u017Cywaj\u0105c materia\u0142u z lekcji.";
  if (type === "fix_sentence") return "Popraw b\u0142\u0105d i wpisz ca\u0142e poprawne zdanie.";
  return "Uzupe\u0142nij luk\u0119 jednym pasuj\u0105cym s\u0142owem lub fraz\u0105.";
};
var defaultHint = (type, level) => {
  if (type === "micro_translation") {
    return level === "small" ? "Zacznij od konstrukcji z lekcji." : "U\u0142\xF3\u017C zdanie wed\u0142ug wzoru z lekcji.";
  }
  if (type === "fix_sentence") {
    return level === "small" ? "B\u0142\u0105d jest w jednym miejscu \u2014 poszukaj go." : "B\u0142\u0105d dotyczy konstrukcji z lekcji.";
  }
  return level === "small" ? "Brakuje jednego s\u0142owa z lekcji." : "To s\u0142owo pojawi\u0142o si\u0119 w s\u0142ownictwie lekcji.";
};
var regenerateDraft = async (input) => {
  const { draft, failedChecks } = input;
  const response = await input.call({
    system: `${buildCoreSystemPrompt()}

Twoje zadanie: poprawi\u0107 \u0107wiczenie, kt\xF3re nie przesz\u0142o kontroli jako\u015Bci.
Zachowujesz ten sam typ i ten sam cel nauki. Naprawiasz wykonanie.`,
    user: `${renderContextForPrompt(input.context)}

---

${EXERCISE_TYPE_BRIEFS[draft.exerciseType]}

---

ZADANIE, KT\xD3RE NIE PRZESZ\u0141O:
${JSON.stringify(
      {
        exerciseType: draft.exerciseType,
        learningObjective: draft.learningObjective,
        content: draft.content,
        instruction: draft.instruction,
        modelAnswer: draft.modelAnswer,
        acceptedVariants: draft.acceptedVariants,
        requiredMaterial: draft.requiredMaterial,
        hintSmall: draft.hintSmall,
        hintLarge: draft.hintLarge
      },
      null,
      2
    )}

ZARZUTY KONTROLERA: ${failedChecks.length > 0 ? failedChecks.join(", ") : "og\xF3lnie za s\u0142abe"}

U\u0142\xF3\u017C to zadanie od nowa tak, \u017Ceby zarzuty przesta\u0142y obowi\u0105zywa\u0107.
Zachowaj \`exerciseType\` i \`learningObjective\`. Zwr\xF3\u0107 pojedynczy obiekt JSON
w tym samym kszta\u0142cie co powy\u017Cej, uzupe\u0142niony o \`commonMistakes\` i \`sourceLessonIndex\`.`,
    taskName: "hw-v2/regenerate",
    temperature: 0.6
  });
  const parsed = parseDraft(response.data, draft.exerciseType);
  if (!parsed) return null;
  return { ...parsed, exerciseType: draft.exerciseType, learningObjective: draft.learningObjective };
};

// functions/src/homeworkV2/qualityValidator.ts
var VALIDATION_PASS_THRESHOLD = 0.7;
var buildValidatorPrompt = (context, draft) => `${renderContextForPrompt(context)}

---

${VALIDATOR_CHECKS}

---

ZADANIE DO SPRAWDZENIA:
{
  "exerciseType": ${JSON.stringify(draft.exerciseType)},
  "learningObjective": ${JSON.stringify(draft.learningObjective)},
  "content": ${JSON.stringify(draft.content)},
  "instruction": ${JSON.stringify(draft.instruction)},
  "modelAnswer": ${JSON.stringify(draft.modelAnswer)},
  "acceptedVariants": ${JSON.stringify(draft.acceptedVariants)},
  "requiredMaterial": ${JSON.stringify(draft.requiredMaterial)},
  "hintSmall": ${JSON.stringify(draft.hintSmall)},
  "hintLarge": ${JSON.stringify(draft.hintLarge)}
}

FORMAT ODPOWIEDZI (JSON):
{
  "passed": true,
  "score": 0.9,
  "failedChecks": [],
  "notes": "jedno zdanie dla lektora, po polsku"
}

\`failedChecks\` zawiera nazwy pyta\u0144, kt\xF3re wypad\u0142y \u017Ale \u2014 dok\u0142adnie tak, jak nazwano je wy\u017Cej
(np. "naturalness_pl", "single_goal"). Je\u015Bli zadanie jest dobre, tablica jest pusta.`;
var validateDraft = async (context, draft, call, regenerationCount) => {
  const response = await call({
    system: `${buildCoreSystemPrompt()}

Twoja rola: niezale\u017Cny kontroler jako\u015Bci \u0107wicze\u0144 j\u0119zykowych.
Nie uk\u0142adasz zada\u0144. Oceniasz cudze. Jeste\u015B surowy i konkretny.`,
    user: buildValidatorPrompt(context, draft),
    taskName: "hw-v2/validate",
    // Ocena ma być powtarzalna — to samo zadanie ma dostać ten sam werdykt.
    temperature: 0
  });
  const verdict = response.data || {};
  const failedChecks = Array.isArray(verdict.failedChecks) ? verdict.failedChecks.filter((c) => typeof c === "string") : [];
  const rawScore = typeof verdict.score === "number" ? verdict.score : 0;
  const score = Math.min(1, Math.max(0, rawScore));
  const passed = verdict.passed === true && failedChecks.length === 0 && score >= VALIDATION_PASS_THRESHOLD;
  return {
    passed,
    score,
    failedChecks,
    regenerationCount,
    modelVersion: response.modelUsed,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
};
var validateAll = async (input) => {
  const results = [];
  for (const originalDraft of input.drafts) {
    let draft = originalDraft;
    let validation = await validateDraft(input.context, draft, input.call, 0);
    let attempts = 0;
    while (!validation.passed && attempts < MAX_REGENERATIONS) {
      attempts += 1;
      const regenerated = await input.regenerate(draft, validation.failedChecks);
      if (!regenerated) break;
      draft = regenerated;
      validation = await validateDraft(input.context, draft, input.call, attempts);
    }
    results.push({
      draft,
      validation,
      requiresTeacherReview: !validation.passed
    });
  }
  return results;
};

// functions/src/homeworkV2/pipeline.ts
var buildExerciseSet = async (input) => {
  const warnings = [...input.plan.warnings];
  const generated = await generateExercises({
    context: input.context,
    slots: input.plan.slots,
    call: input.call
  });
  if (generated.drafts.length === 0) {
    throw new Error("Model nie zwr\xF3ci\u0142 ani jednego poprawnego zadania.");
  }
  if (generated.missingSlots > 0) {
    warnings.push(
      `Zam\xF3wiono ${input.plan.slots.length} zada\u0144, a model zwr\xF3ci\u0142 ${generated.drafts.length}. Brakuj\u0105ce pozycje zosta\u0142y pomini\u0119te.`
    );
  }
  const validated = await validateAll({
    context: input.context,
    drafts: generated.drafts,
    call: input.call,
    regenerate: (draft, failedChecks) => regenerateDraft({ context: input.context, draft, failedChecks, call: input.call })
  });
  const exercises = validated.map((item, index) => {
    const slot = input.plan.slots[index] || input.plan.slots[0];
    return finalizeContract({
      draft: item.draft,
      slot,
      context: input.context,
      teacherId: input.teacherId,
      studentId: input.studentId,
      groupId: input.groupId,
      modelVersion: generated.modelUsed,
      validation: item.validation,
      requiresTeacherReview: item.requiresTeacherReview
    });
  });
  const needsReviewCount = exercises.filter((e) => e.requiresTeacherReview).length;
  if (needsReviewCount > 0) {
    warnings.push(
      `${needsReviewCount} z ${exercises.length} zada\u0144 nie przesz\u0142o kontroli jako\u015Bci i wymaga Twojej decyzji przed wys\u0142aniem.`
    );
  }
  return { exercises, warnings, needsReviewCount, modelUsed: generated.modelUsed };
};

// functions/src/homeworkV2/openai.ts
var V2_PRIMARY_MODEL = "gemini-2.5-flash";
var V2_FALLBACK_MODEL = "gemini-3.8-flash";
var V2_TERTIARY_MODEL = "gpt-4o-mini";
var V2_MODEL_CASCADE = [
  V2_PRIMARY_MODEL,
  V2_FALLBACK_MODEL,
  V2_TERTIARY_MODEL
];
var mapToActualOpenAIModel = (modelName) => {
  const clean = String(modelName || "").replace(/^openai\//, "").trim().toLowerCase();
  if (clean === "gpt-5.6-luna" || clean === "gpt-5.6" || clean.includes("luna")) return "gpt-4o";
  if (clean.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (clean.includes("gpt-4o")) return "gpt-4o";
  return "gpt-4o-mini";
};
var mapToActualGeminiModel = (modelName) => {
  const clean = String(modelName || "").trim().toLowerCase();
  if (clean.includes("2.5-flash") || clean === "gemini-2.5-flash") return "gemini-2.5-flash";
  if (clean.includes("3.8-flash") || clean === "gemini-3.8-flash") return "gemini-2.5-flash";
  if (clean.includes("1.5-flash")) return "gemini-1.5-flash";
  return "gemini-2.5-flash";
};
var extractJson = (text) => {
  if (!text) throw new Error("Model zwr\xF3ci\u0142 pust\u0105 odpowied\u017A.");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced && fenced[1] ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const firstBracket = candidate.indexOf("[");
    const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Odpowied\u017A modelu nie zawiera poprawnego JSON-a.");
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }
};
var OPENAI_URL = "https://api.openai.com/v1/chat/completions";
var GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
var REQUEST_TIMEOUT_MS = 6e4;
var COST_PER_MTOK = {
  "gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 }
};
var estimateCostUsd = (apiModel, promptTokens, completionTokens) => {
  const rate = COST_PER_MTOK[apiModel];
  if (!rate) return 0;
  return (promptTokens * rate.input + completionTokens * rate.output) / 1e6;
};
var createAiCall = (keys) => {
  return async (request) => {
    const geminiKey = (keys.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
    const openAiKey = (keys.openAiApiKey || process.env.OPENAI_API_KEY || "").trim();
    if (!geminiKey && !openAiKey) {
      throw new Error("Brak kluczy GEMINI_API_KEY oraz OPENAI_API_KEY \u2014 silnik v2 nie ma czym generowa\u0107.");
    }
    const errors = [];
    for (const logicalModel of V2_MODEL_CASCADE) {
      const isGemini = logicalModel.startsWith("gemini");
      const startedAt = Date.now();
      if (isGemini) {
        if (!geminiKey) {
          errors.push(`${logicalModel}: brak GEMINI_API_KEY`);
          continue;
        }
        const apiModel = mapToActualGeminiModel(logicalModel);
        const url = `${GEMINI_BASE_URL}/${apiModel}:generateContent?key=${geminiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: request.user }]
                }
              ],
              systemInstruction: {
                parts: [{ text: `${request.system}

Odpowiadaj wy\u0142\u0105cznie poprawnym JSON-em.` }]
              },
              generationConfig: {
                responseMimeType: "application/json",
                temperature: request.temperature ?? 0.3
              }
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const latencyMs = Date.now() - startedAt;
          if (!response.ok) {
            const errText = await response.text();
            errors.push(`${logicalModel}: HTTP ${response.status} (${errText.slice(0, 100)})`);
            continue;
          }
          const payload = await response.json();
          const content = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (!content) {
            errors.push(`${logicalModel}: pusta odpowied\u017A`);
            continue;
          }
          const promptTokens = payload.usageMetadata?.promptTokenCount ?? 0;
          const completionTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;
          console.info("[hw-v2] wywo\u0142anie modelu Gemini", {
            taskName: request.taskName,
            model: logicalModel,
            apiModel,
            latencyMs,
            promptTokens,
            completionTokens,
            estimatedCostUsd: Number(estimateCostUsd(apiModel, promptTokens, completionTokens).toFixed(6))
          });
          return { data: extractJson(content), modelUsed: logicalModel, latencyMs };
        } catch (error) {
          clearTimeout(timeoutId);
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${logicalModel}: ${message}`);
        }
      } else {
        if (!openAiKey) {
          errors.push(`${logicalModel}: brak OPENAI_API_KEY`);
          continue;
        }
        const apiModel = mapToActualOpenAIModel(logicalModel);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
              model: apiModel,
              messages: [
                { role: "system", content: `${request.system}

Odpowiadaj wy\u0142\u0105cznie poprawnym JSON-em.` },
                { role: "user", content: request.user }
              ],
              temperature: request.temperature ?? 0.3,
              response_format: { type: "json_object" }
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const latencyMs = Date.now() - startedAt;
          if (!response.ok) {
            const errText = await response.text();
            errors.push(`${logicalModel}: HTTP ${response.status}`);
            if (response.status === 401 || response.status === 429 || errText.includes("insufficient_quota")) {
              errors.push(`OpenAI odmawia (${response.status}). Sprawd\u017A OPENAI_API_KEY i limity konta.`);
            }
            continue;
          }
          const payload = await response.json();
          const content = payload.choices?.[0]?.message?.content || "";
          if (!content) {
            errors.push(`${logicalModel}: pusta odpowied\u017A`);
            continue;
          }
          const promptTokens = payload.usage?.prompt_tokens ?? 0;
          const completionTokens = payload.usage?.completion_tokens ?? 0;
          console.info("[hw-v2] wywo\u0142anie modelu OpenAI", {
            taskName: request.taskName,
            model: logicalModel,
            apiModel,
            latencyMs,
            promptTokens,
            completionTokens,
            estimatedCostUsd: Number(estimateCostUsd(apiModel, promptTokens, completionTokens).toFixed(6))
          });
          return { data: extractJson(content), modelUsed: logicalModel, latencyMs };
        } catch (error) {
          clearTimeout(timeoutId);
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${logicalModel}: ${message}`);
        }
      }
    }
    throw new Error(`\u017Baden model nie odpowiedzia\u0142. Pr\xF3by: ${errors.join("; ")}`);
  };
};

// functions/src/homeworkV2/learningProfile.ts
var profileRef = (studentUid) => getDb().collection("users").doc(studentUid).collection("profile").doc("homeworkV2");
var getRecentMistakes = async (studentUid) => {
  try {
    const snapshot = await profileRef(studentUid).get();
    const profile = snapshot.data();
    return profile?.recentMistakes || [];
  } catch {
    return [];
  }
};

// functions/src/homeworkV2/assignment.ts
var selectSendableExercises = (rawExercises) => (Array.isArray(rawExercises) ? rawExercises : []).filter(
  (item) => isExerciseContractV2(item) && !item.requiresTeacherReview
);
var buildV2TaskPayload = (input) => ({
  // --- pola wymagane przez v1 i przez reguły ---
  studentUid: input.studentUid,
  studentId: input.studentUid,
  userId: input.studentUid,
  studentIds: [input.studentUid],
  studentName: input.studentName || "Kursant",
  ...input.studentEmail ? { studentEmail: input.studentEmail } : {},
  ...input.studentUsername ? { studentUsername: input.studentUsername } : {},
  title: input.title,
  instructions: "Masz trzy pr\xF3by na ka\u017Cde zadanie. Podpowied\u017A pojawi si\u0119, gdy b\u0119dzie potrzebna.",
  createdAt: input.createdAt,
  ...input.dueDate ? { dueDate: input.dueDate } : {},
  status: "pending",
  sentences: input.exercises.map((exercise) => ({ ...exercise, studentId: input.studentUid })),
  // --- tryb mailingu identyczny jak w kreatorach v1 ---
  manualEmailConfirmationRequired: true,
  skipAutoEmail: true,
  emailNotificationSent: false,
  // --- pola v2 ---
  engineVersion: ENGINE_VERSION,
  schemaVersion: SCHEMA_VERSION,
  teacherId: input.teacherId,
  homeworkSetId: input.homeworkSetId,
  ...input.groupId ? { groupId: input.groupId } : {},
  mode: "training",
  assignedBy: "Lektor"
});
var newHomeworkSetId = () => `hwset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// utils/polishVocative.ts
function formatOnlyFirstName(rawName) {
  if (!rawName || typeof rawName !== "string") return "";
  let trimmed = rawName.trim();
  if (!trimmed) return "";
  trimmed = trimmed.replace(/^[,.\s!:]+|[,.\s!:]+$/g, "");
  if (trimmed.includes(" ")) {
    trimmed = trimmed.split(/\s+/)[0];
  }
  if (trimmed.includes(".")) {
    trimmed = trimmed.split(".")[0];
  }
  if (trimmed.includes("_")) {
    trimmed = trimmed.split("_")[0];
  }
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
function toPolishVocative(rawName) {
  const name = formatOnlyFirstName(rawName);
  if (!name) return "";
  const irregulars = {
    "anna": "Anno",
    "marta": "Marto",
    "kuba": "Kubo",
    "tomek": "Tomku",
    "bartek": "Bartku",
    "wojtek": "Wojtku",
    "przemek": "Przemku",
    "kacper": "Kacprze",
    "piotr": "Piotrze",
    "pawe\u0142": "Pawle",
    "pawel": "Pawle",
    "micha\u0142": "Michale",
    "michal": "Michale",
    "marek": "Marku",
    "jacek": "Jacku",
    "leszek": "Leszku",
    "franciszek": "Franciszku",
    "aleksander": "Aleksandrze",
    "artur": "Arturze",
    "wiktor": "Wiktorze",
    "igor": "Igorze",
    "grzegorz": "Grzegorzu",
    "\u0142ukasz": "\u0141ukaszu",
    "lukasz": "\u0141ukaszu",
    "mateusz": "Mateuszu",
    "bartosz": "Bartoszu",
    "tomasz": "Tomaszu",
    "janusz": "Januszu",
    "mariusz": "Mariuszu",
    "dariusz": "Dariuszu",
    "arkadiusz": "Arkadiuszu",
    "tadeusz": "Tadeuszu",
    "maciej": "Macieju",
    "andrzej": "Andrzeju",
    "miko\u0142aj": "Miko\u0142aju",
    "mikolaj": "Miko\u0142aju",
    "rafa\u0142": "Rafale",
    "rafal": "Rafale",
    "karol": "Karolu",
    "kamil": "Kamilu",
    "emil": "Emilu",
    "daniel": "Danielu",
    "gabriel": "Gabrielu",
    "adam": "Adamie",
    "przemys\u0142aw": "Przemys\u0142awie",
    "przemyslaw": "Przemys\u0142awie",
    "stanis\u0142aw": "Stanis\u0142awie",
    "stanislaw": "Stanis\u0142awie",
    "rados\u0142aw": "Rados\u0142awie",
    "radoslaw": "Rados\u0142awie",
    "jaros\u0142aw": "Jaros\u0142awie",
    "jaroslaw": "Jaros\u0142awie",
    "miros\u0142aw": "Miros\u0142awie",
    "miroslaw": "Miros\u0142awie",
    "boles\u0142aw": "Boles\u0142awie",
    "w\u0142adys\u0142aw": "W\u0142adys\u0142awie",
    "wladyslaw": "W\u0142adys\u0142awie",
    "jan": "Janie",
    "marcin": "Marcinie",
    "damian": "Damianie",
    "szymon": "Szymonie",
    "adrian": "Adrianie",
    "sebastian": "Sebastianie",
    "krystian": "Krystianie",
    "fabian": "Fabianie",
    "julian": "Julianie",
    "roman": "Romanie",
    "marian": "Marianie",
    "szczepan": "Szczepanie",
    "stefan": "Stefanie",
    "jakub": "Jakubie",
    "filip": "Filipie",
    "krzysztof": "Krzysztofie",
    "dawid": "Dawidzie",
    "konrad": "Konradzie",
    "robert": "Robercie",
    "hubert": "Hubercie",
    "norbert": "Norbercie",
    "albert": "Albercie",
    "zbigniew": "Zbigniewie",
    "bogdan": "Bogdanie",
    "dominik": "Dominiku",
    "eryk": "Eryku",
    "patryk": "Patryku",
    "oskar": "Oskarze",
    "cezary": "Cezary",
    "jerzy": "Jerzy",
    "antoni": "Antoni",
    "ignacy": "Ignacy",
    // Żeńskie zdrobnienia
    "kasia": "Kasiu",
    "basia": "Basiu",
    "zuzia": "Zuziu",
    "ania": "Aniu",
    "marysia": "Marysiu",
    "gosia": "Gosiu",
    "zosia": "Zosiu",
    "madzia": "Madziu",
    "ola": "Olu",
    "asia": "Asiu",
    "aga": "Agu",
    "ula": "Ulu"
  };
  const lower = name.toLowerCase();
  if (irregulars[lower]) {
    const res = irregulars[lower];
    return res.charAt(0).toUpperCase() + res.slice(1);
  }
  if (lower.endsWith("a")) {
    if (/(sia|cia|zia|dzia|nia)$/.test(lower)) {
      return name.slice(0, -1) + "u";
    }
    return name.slice(0, -1) + "o";
  }
  if (lower.endsWith("ek")) {
    return name.slice(0, -2) + "ku";
  }
  if (lower.endsWith("ik") || lower.endsWith("yk")) {
    return name + "u";
  }
  if (lower.endsWith("sz") || lower.endsWith("cz") || lower.endsWith("rz")) {
    return name + "u";
  }
  if (lower.endsWith("ej") || lower.endsWith("aj")) {
    return name + "u";
  }
  if (lower.endsWith("aw")) {
    return name + "ie";
  }
  if (lower.endsWith("an") || lower.endsWith("on") || lower.endsWith("in") || lower.endsWith("en")) {
    return name + "ie";
  }
  if (lower.endsWith("b") || lower.endsWith("p")) {
    return name + "ie";
  }
  if (lower.endsWith("d")) {
    return name.slice(0, -1) + "dzie";
  }
  if (lower.endsWith("t")) {
    return name.slice(0, -1) + "cie";
  }
  if (lower.endsWith("m") || lower.endsWith("w")) {
    return name + "ie";
  }
  if (lower.endsWith("r")) {
    return name + "ze";
  }
  if (lower.endsWith("l")) {
    return name + "u";
  }
  if (lower.endsWith("\u0142")) {
    return name.slice(0, -1) + "le";
  }
  return name;
}
function formatPolishGreeting(rawName) {
  const vocative = toPolishVocative(rawName);
  if (!vocative) return "Cze\u015B\u0107!";
  return `Cze\u015B\u0107, ${vocative}!`;
}

// services/homeworkEmail.ts
var escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var INSTRUCTOR_CARD_HTML = `
  <div style="margin:28px 0 0;border:1.5px solid #334155;border-radius:12px;background:#0f172a;padding:20px 22px;text-align:left;">
    <div style="font-size:18px;font-weight:800;color:#e2e8f0;line-height:1.25;letter-spacing:-0.01em;">
      Maciej Wyrozumski
    </div>
    <div style="margin-top:4px;font-size:13px;font-weight:400;color:#94a3b8;line-height:1.4;">
      Instructional Designer | AI EdTech Specialist | English Trainer
    </div>
    <div style="margin:14px 0 12px;border-top:1px solid #334155;height:0;line-height:0;font-size:0;">&nbsp;</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">\u2709\uFE0F</td>
        <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
          <a href="mailto:wyrozumski@maciej.pro" style="color:#e2e8f0;text-decoration:none;font-weight:500;">wyrozumski@maciej.pro</a>
        </td>
      </tr>
      <tr>
        <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">\u{1F4DE}</td>
        <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
          <a href="tel:+48698250507" style="color:#e2e8f0;text-decoration:none;font-weight:500;">+48 698 250 507</a>
        </td>
      </tr>
      <tr>
        <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">\u{1F310}</td>
        <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
          <a href="https://www.maciej.pro" target="_blank" rel="noopener noreferrer" style="color:#e2e8f0;text-decoration:none;font-weight:500;">www.maciej.pro</a>
        </td>
      </tr>
      <tr>
        <td style="width:24px;vertical-align:middle;padding:4px 0;font-size:15px;line-height:1;">\u{1F517}</td>
        <td style="vertical-align:middle;padding:4px 0 4px 8px;font-size:13.5px;">
          <a href="https://linkedin.com/in/maciej-pro" target="_blank" rel="noopener noreferrer" style="color:#e2e8f0;text-decoration:none;font-weight:500;">linkedin.com/in/maciej-pro</a>
        </td>
      </tr>
    </table>
  </div>
`;
function buildGradedHomeworkEmail(params) {
  const {
    studentName,
    title,
    score,
    teacherFeedback,
    gradedBy = "Maciej Wyrozumski",
    appUrl = "https://app.maciej.pro",
    unsubscribeUrl
  } = params;
  const greeting = formatPolishGreeting(studentName);
  const cleanTitle = title.trim() || "Praca domowa";
  const subject = `Sprawdzi\u0142em Twoj\u0105 prac\u0119 domow\u0105: ${cleanTitle} \u{1F393} | CRIBRO English`;
  const scoreBadge = typeof score === "number" ? `<div style="margin:20px 0;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px 20px;text-align:center;">
           <span style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:4px;">Tw\xF3j wynik</span>
           <span style="font-size:32px;font-weight:900;color:#72f0b4;font-family:'Courier New',monospace;">${score}%</span>
         </div>` : "";
  const feedbackBlock = teacherFeedback ? `<div style="margin:16px 0;background:rgba(114,240,180,0.08);border-left:4px solid #72f0b4;padding:14px 18px;border-radius:0 10px 10px 0;">
         <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#72f0b4;text-transform:uppercase;letter-spacing:0.06em;">Komentarz i wskaz\xF3wki ode mnie:</p>
         <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(teacherFeedback)}</p>
       </div>` : "";
  const unsubscribeHtml = unsubscribeUrl ? `<div style="margin-top:24px;text-align:center;font-size:11px;color:#64748b;">
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Wypisz si\u0119 z powiadomie\u0144 e-mail</a>
       </div>` : "";
  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#09101c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#141b2a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
      <tr>
        <td style="background:linear-gradient(90deg, #72f0b4, #3b82f6);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 28px;">
          <div style="margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#72f0b4;">CRIBRO ENGLISH</p>
            <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;background:rgba(114,240,180,0.15);color:#72f0b4;border:1px solid rgba(114,240,180,0.3);padding:3px 10px;border-radius:999px;">\u{1F393} SPRAWDZONA PRACA DOMOWA</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;font-weight:800;">
            ${escapeHtml(greeting)}
          </h1>

          <p style="margin:0 0 14px;color:#cbd5e1;font-size:15px;line-height:1.65;">
            Sprawdzi\u0142em Twoj\u0105 prac\u0119 domow\u0105 <strong style="color:#ffffff;">\u201E${escapeHtml(cleanTitle)}\u201D</strong>. Zajrzyj do aplikacji, aby sprawdzi\u0107 sw\xF3j wynik i ewentualnie prze\u0107wiczy\u0107 rzeczy do poprawy.
          </p>

          ${scoreBadge}
          ${feedbackBlock}

          <div style="margin:26px 0 0;text-align:center;">
            <a href="${escapeHtml(appUrl)}"
               style="display:inline-block;background:#72f0b4;background:linear-gradient(135deg, #72f0b4 0%, #10b981 100%);color:#06120c;text-decoration:none;
                      padding:15px 36px;border-radius:12px;font-size:16px;font-weight:800;box-shadow:0 4px 16px rgba(114, 240, 180, 0.4);">
              Zobacz ocenion\u0105 prac\u0119 w aplikacji \u2192
            </a>
          </div>

          ${INSTRUCTOR_CARD_HTML}
          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = `${greeting}

Sprawdzi\u0142em Twoj\u0105 prac\u0119 domow\u0105 \u201E${cleanTitle}\u201D. Zajrzyj do aplikacji, aby sprawdzi\u0107 sw\xF3j wynik i ewentualnie prze\u0107wiczy\u0107 rzeczy do poprawy.${score !== void 0 && score !== null ? `

Tw\xF3j wynik: ${score}%` : ""}${teacherFeedback ? `

Komentarz lektora:
${teacherFeedback}` : ""}

Otw\xF3rz aplikacj\u0119: ${appUrl}

\u2014
${gradedBy}
CRIBRO ENGLISH`;
  return { subject, html, text, greeting };
}

// utils/learningCurve.ts
var CEFR_LEVELS2 = ["A1", "A2", "B1", "B2", "C1", "C2"];
var DECISION_WINDOW = 12;
var PROMOTE_ACCURACY = 0.85;
var DEMOTE_ACCURACY = 0.45;
var MAX_DRIFT_FROM_BASE = 1;
var MAX_RECENT_MISTAKES = 15;
var MAX_RECENT_OUTCOMES = DECISION_WINDOW * 2;
var isCefrLevel = (value) => typeof value === "string" && CEFR_LEVELS2.includes(value);
var normalizeLevel = (raw, fallback = "B1") => {
  if (isCefrLevel(raw)) return raw;
  const text = String(raw || "").toUpperCase();
  const match = text.match(/[ABC][12]/g);
  if (!match || match.length === 0) return fallback;
  const found = match.filter(isCefrLevel);
  if (found.length === 0) return fallback;
  return found.reduce(
    (lowest, level) => CEFR_LEVELS2.indexOf(level) < CEFR_LEVELS2.indexOf(lowest) ? level : lowest
  );
};
var shiftLevel = (level, step) => {
  const index = CEFR_LEVELS2.indexOf(level);
  const next = Math.min(CEFR_LEVELS2.length - 1, Math.max(0, index + step));
  return CEFR_LEVELS2[next];
};
var levelDistance = (a, b) => CEFR_LEVELS2.indexOf(a) - CEFR_LEVELS2.indexOf(b);
var emptyTally = () => ({ attempts: 0, correct: 0, scoreSum: 0 });
var addToTally = (tally, attempt) => {
  const base = tally || emptyTally();
  return {
    attempts: base.attempts + 1,
    correct: base.correct + (attempt.isCorrect ? 1 : 0),
    scoreSum: base.scoreSum + (Number.isFinite(attempt.score) ? attempt.score : 0)
  };
};
function createProfile(studentId, baseLevel, now) {
  return {
    studentId,
    baseLevel,
    currentLevel: baseLevel,
    totalAttempts: 0,
    totalCorrect: 0,
    byLevel: {},
    byExerciseType: {},
    recentOutcomes: [],
    attemptsSinceLevelChange: 0,
    recentMistakes: [],
    levelHistory: [],
    updatedAt: now,
    lastUpdated: now,
    createdAt: now
  };
}
function recordAttempts(profile, attempts, now) {
  if (attempts.length === 0) return profile;
  const next = {
    ...profile,
    byLevel: { ...profile.byLevel },
    byExerciseType: { ...profile.byExerciseType },
    recentOutcomes: [...profile.recentOutcomes],
    recentMistakes: [...profile.recentMistakes],
    levelHistory: [...profile.levelHistory],
    updatedAt: now,
    lastUpdated: now
  };
  attempts.forEach((attempt) => {
    next.totalAttempts += 1;
    if (attempt.isCorrect) next.totalCorrect += 1;
    next.attemptsSinceLevelChange += 1;
    next.byLevel[attempt.level] = addToTally(next.byLevel[attempt.level], attempt);
    next.byExerciseType[attempt.exerciseType] = addToTally(
      next.byExerciseType[attempt.exerciseType],
      attempt
    );
    next.recentOutcomes.push(attempt.isCorrect);
    if (!attempt.isCorrect) {
      next.recentMistakes.push({
        prompt: attempt.prompt,
        expected: attempt.expected || "",
        given: attempt.given || "",
        exerciseType: attempt.exerciseType,
        date: attempt.date
      });
    }
  });
  next.recentOutcomes = next.recentOutcomes.slice(-MAX_RECENT_OUTCOMES);
  next.recentMistakes = next.recentMistakes.slice(-MAX_RECENT_MISTAKES);
  return next;
}
var windowAccuracy = (profile) => {
  const window = profile.recentOutcomes.slice(-DECISION_WINDOW);
  if (window.length === 0) return 0;
  return window.filter(Boolean).length / window.length;
};
function evaluateLevelChange(profile, now) {
  const window = profile.recentOutcomes.slice(-DECISION_WINDOW);
  if (window.length < DECISION_WINDOW || profile.attemptsSinceLevelChange < DECISION_WINDOW) {
    return {
      level: profile.currentLevel,
      changed: false,
      reason: "Za ma\u0142o pr\xF3b od ostatniej zmiany, \u017Ceby rusza\u0107 poziomem."
    };
  }
  const accuracy = windowAccuracy(profile);
  const percent = Math.round(accuracy * 100);
  if (accuracy >= PROMOTE_ACCURACY) {
    const candidate = shiftLevel(profile.currentLevel, 1);
    if (candidate === profile.currentLevel) {
      return { level: profile.currentLevel, changed: false, reason: "Najwy\u017Cszy poziom skali." };
    }
    if (levelDistance(candidate, profile.baseLevel) > MAX_DRIFT_FROM_BASE) {
      return {
        level: profile.currentLevel,
        changed: false,
        reason: `Skuteczno\u015B\u0107 ${percent}%, ale wy\u017Cej ni\u017C ${MAX_DRIFT_FROM_BASE} stopie\u0144 ponad poziom od lektora nie schodzimy bez jego decyzji.`
      };
    }
    return {
      level: candidate,
      changed: true,
      reason: `Skuteczno\u015B\u0107 ${percent}% w ostatnich ${DECISION_WINDOW} zadaniach \u2014 podnosimy poziom.`
    };
  }
  if (accuracy <= DEMOTE_ACCURACY) {
    const candidate = shiftLevel(profile.currentLevel, -1);
    if (candidate === profile.currentLevel) {
      return { level: profile.currentLevel, changed: false, reason: "Najni\u017Cszy poziom skali." };
    }
    if (levelDistance(profile.baseLevel, candidate) > MAX_DRIFT_FROM_BASE) {
      return {
        level: profile.currentLevel,
        changed: false,
        reason: `Skuteczno\u015B\u0107 ${percent}%, ale ni\u017Cej ni\u017C ${MAX_DRIFT_FROM_BASE} stopie\u0144 pod poziom od lektora nie schodzimy bez jego decyzji.`
      };
    }
    return {
      level: candidate,
      changed: true,
      reason: `Skuteczno\u015B\u0107 ${percent}% w ostatnich ${DECISION_WINDOW} zadaniach \u2014 obni\u017Camy poziom.`
    };
  }
  return {
    level: profile.currentLevel,
    changed: false,
    reason: `Skuteczno\u015B\u0107 ${percent}% mie\u015Bci si\u0119 w przedziale roboczym \u2014 poziom bez zmian.`
  };
}
function applyLevelDecision(profile, decision, now) {
  if (!decision.changed) return profile;
  return {
    ...profile,
    currentLevel: decision.level,
    attemptsSinceLevelChange: 0,
    levelHistory: [
      ...profile.levelHistory,
      { date: now, from: profile.currentLevel, to: decision.level, reason: decision.reason }
    ].slice(-30),
    updatedAt: now,
    lastUpdated: now
  };
}
function ingestAttempts(profile, attempts, now) {
  const recorded = recordAttempts(profile, attempts, now);
  const decision = evaluateLevelChange(recorded, now);
  return { profile: applyLevelDecision(recorded, decision, now), decision };
}
function serializeLearningProfile(profile, createdAt) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    studentId: profile.studentId,
    baseLevel: profile.baseLevel,
    currentLevel: profile.currentLevel,
    totalAttempts: profile.totalAttempts,
    totalCorrect: profile.totalCorrect,
    byLevel: profile.byLevel || {},
    byExerciseType: profile.byExerciseType || {},
    recentOutcomes: profile.recentOutcomes || [],
    attemptsSinceLevelChange: profile.attemptsSinceLevelChange || 0,
    recentMistakes: profile.recentMistakes || [],
    levelHistory: profile.levelHistory || [],
    lastUpdated: profile.lastUpdated || profile.updatedAt || now,
    createdAt: profile.createdAt || createdAt || profile.updatedAt || now
  };
}
function deserializeLearningProfile(studentId, stored, baseLevel) {
  const fallbackLevel = normalizeLevel(baseLevel);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const profile = createProfile(
    studentId,
    fallbackLevel,
    stored.lastUpdated || stored.updatedAt || now
  );
  return {
    ...profile,
    ...stored,
    studentId,
    baseLevel: fallbackLevel,
    currentLevel: normalizeLevel(stored.currentLevel, fallbackLevel),
    byLevel: stored.byLevel || {},
    byExerciseType: stored.byExerciseType || {},
    recentOutcomes: stored.recentOutcomes || [],
    recentMistakes: stored.recentMistakes || [],
    levelHistory: stored.levelHistory || [],
    lastUpdated: stored.lastUpdated || stored.updatedAt || now,
    createdAt: stored.createdAt || now
  };
}

// server.ts
function mapToActualOpenAIModel2(modelName) {
  const clean = String(modelName || "").replace(/^openai\//, "").trim().toLowerCase();
  if (clean === "gpt-5.6-luna" || clean === "gpt-5.6" || clean.includes("luna")) {
    return "gpt-4o";
  }
  if (clean.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (clean.includes("gpt-4o")) return "gpt-4o";
  if (clean.includes("o3-mini")) return "o3-mini";
  if (clean.includes("gpt-4-turbo")) return "gpt-4-turbo";
  if (clean.includes("gpt-4")) return "gpt-4";
  if (clean.includes("gpt-3.5-turbo") || clean.includes("gpt-3.5")) return "gpt-3.5-turbo";
  return "gpt-4o-mini";
}
function mapToActualAnthropicModel(modelName) {
  const clean = String(modelName || "").replace(/^anthropic\//, "").trim().toLowerCase();
  if (clean.includes("3-7") || clean.includes("3.7")) return "claude-3-7-sonnet-20250219";
  if (clean.includes("3-5-haiku") || clean.includes("3.5-haiku") || clean.includes("haiku")) return "claude-3-5-haiku-20241022";
  if (clean.includes("3-5-sonnet") || clean.includes("3.5-sonnet") || clean.includes("sonnet")) return "claude-3-5-sonnet-20241022";
  return "claude-3-7-sonnet-20250219";
}
function mapToActualDeepSeekModel(modelName) {
  const clean = String(modelName || "").replace(/^deepseek\//, "").trim().toLowerCase();
  if (clean.includes("reasoner") || clean.includes("r1")) return "deepseek-reasoner";
  return "deepseek-chat";
}
function extractJsonFromString(str) {
  if (!str || typeof str !== "string") return null;
  const start = str.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(str.slice(start, i + 1));
            if (parsed && typeof parsed === "object") return parsed;
          } catch {
          }
        }
      }
    }
  }
  return null;
}
function formatErrorString(err) {
  if (!err) return "Wyst\u0105pi\u0142 nieznany b\u0142\u0105d";
  if (typeof err === "string") {
    const parsed = extractJsonFromString(err);
    if (parsed) {
      return formatErrorString(parsed);
    }
    if (err.includes("All models failed")) {
      const lines = err.split("\n").filter((l) => l.trim() && !l.startsWith("Details:") && !l.startsWith("All models failed"));
      if (lines.length > 0) {
        return lines.map((l) => formatErrorString(l.replace(/^\[[^\]]+\]\s*/, ""))).join("; ");
      }
    }
    return err.trim() || "Wyst\u0105pi\u0142 b\u0142\u0105d";
  }
  if (err.error) {
    if (typeof err.error === "string") return formatErrorString(err.error);
    if (typeof err.error === "object") {
      if (err.error.message && typeof err.error.message === "string") {
        return err.error.message.trim();
      }
      if (err.error.errors) {
        return formatErrorString(err.error.errors);
      }
      if (err.error.error) {
        return formatErrorString(err.error.error);
      }
      if (err.error.details) {
        return formatErrorString(err.error.details);
      }
      return formatErrorString(err.error);
    }
    return String(err.error);
  }
  if (err.errors) {
    if (Array.isArray(err.errors)) {
      const msgs = err.errors.map((e) => typeof e === "object" ? e.message || formatErrorString(e) : String(e)).filter(Boolean);
      if (msgs.length > 0) return msgs.join(", ");
    } else if (typeof err.errors === "string") {
      return err.errors.trim();
    } else if (typeof err.errors === "object") {
      return formatErrorString(err.errors);
    }
  }
  if (Array.isArray(err)) {
    const msgs = err.map((e) => typeof e === "object" ? e.message || formatErrorString(e) : String(e)).filter(Boolean);
    if (msgs.length > 0) return msgs.join(", ");
  }
  if (err.message && typeof err.message === "string") {
    const parsed = extractJsonFromString(err.message);
    if (parsed) {
      return formatErrorString(parsed);
    }
    return err.message.trim();
  }
  if (err.statusText && typeof err.statusText === "string") {
    return err.statusText.trim();
  }
  return String(err);
}
var pdfParse;
try {
  const loadedPdf = typeof __require !== "undefined" ? __require("pdf-parse") : null;
  if (loadedPdf) {
    pdfParse = typeof loadedPdf === "function" ? loadedPdf : loadedPdf.default || loadedPdf;
  }
} catch (e) {
  console.warn("Failed to load pdf-parse:", e);
}
async function generateContentWithRetry(aiClient, contents, config, customModels) {
  const models = customModels || AI_MODEL_CASCADE;
  let lastError;
  const errors = [];
  for (const model of models) {
    let retries = 2;
    while (retries > 0) {
      try {
        console.log(`[Server] Attempting generation with ${model}... (retries left: ${retries})`);
        let promptText = "";
        if (typeof contents === "string") {
          promptText = contents;
        } else if (Array.isArray(contents)) {
          promptText = contents.map((c) => {
            if (typeof c === "string") return c;
            if (c.text) return c.text;
            if (c.parts && Array.isArray(c.parts)) {
              return c.parts.map((p) => typeof p === "string" ? p : p.text || "").join("\n");
            }
            if (c.inlineData) return "[Za\u0142\u0105czono plik, kt\xF3ry nie mo\u017Ce by\u0107 bezpo\u015Brednio przetworzony jako tekst]";
            return typeof c === "object" ? JSON.stringify(c) : String(c);
          }).filter(Boolean).join("\n");
        } else if (contents && contents.parts && Array.isArray(contents.parts)) {
          promptText = contents.parts.map((p) => {
            if (typeof p === "string") return p;
            if (p.text) return p.text;
            if (p.inlineData) return "[Za\u0142\u0105czono plik, kt\xF3ry nie mo\u017Ce by\u0107 bezpo\u015Brednio przetworzony jako tekst]";
            return typeof p === "object" ? JSON.stringify(p) : String(p);
          }).filter(Boolean).join("\n");
        } else if (contents && typeof contents === "object" && contents.text) {
          promptText = contents.text;
        } else {
          promptText = JSON.stringify(contents);
        }
        let sysInst = config?.systemInstruction || "";
        if (model.startsWith("openai")) {
          const apiKey = getOpenAIApiKey();
          if (!apiKey) {
            console.warn("[Server] OPENAI_API_KEY not configured, skipping model");
            throw new Error("OPENAI_API_KEY not configured");
          }
          const targetModel = mapToActualOpenAIModel2(model);
          const isJsonMode = config?.responseMimeType === "application/json";
          let finalPrompt = promptText;
          if (isJsonMode) {
            if (!sysInst.toLowerCase().includes("json")) {
              sysInst = (sysInst ? sysInst + "\n\n" : "") + "Respond in valid JSON format.";
            }
            if (!finalPrompt.toLowerCase().includes("json")) {
              finalPrompt += "\n\nReturn output in valid JSON format.";
            }
          }
          const bodyPayload = {
            model: targetModel,
            messages: [
              ...sysInst ? [{ role: "system", content: sysInst }] : [],
              { role: "user", content: finalPrompt || "Generate content" }
            ],
            temperature: config?.temperature !== void 0 ? config.temperature : 0.7
          };
          if (isJsonMode) {
            bodyPayload.response_format = { type: "json_object" };
          }
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6e4);
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            const errText = await response.text();
            console.warn(`[Server] OpenAI API Error [${response.status}] for ${model} (target ${targetModel}):`, errText);
            const errObj = new Error(`OpenAI API error (${response.status}): ${errText}`);
            errObj.status = response.status;
            throw errObj;
          }
          const data = await response.json();
          return { text: data.choices?.[0]?.message?.content || "" };
        } else {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timed out after 60 seconds")), 6e4);
          });
          const apiCall = aiClient.models.generateContent({
            model,
            contents,
            config
          });
          const response = await Promise.race([apiCall, timeoutPromise]);
          return response;
        }
      } catch (err) {
        const errorMsg = err?.status ? `${err.status} - ${err.message}` : err?.message || String(err);
        errors.push(`[${model}] ${errorMsg}`);
        console.warn(`[Server] Model ${model} failed:`, errorMsg);
        lastError = err;
        if (err?.message?.includes("timed out")) {
          break;
        } else if (String(err?.status) === "429" || err?.message?.toLowerCase().includes("quota") || err?.message?.includes("429") || err?.message?.toLowerCase().includes("too many requests")) {
          console.warn("[Server] Quota exceeded, switching model immediately");
          break;
        } else if (String(err?.status) === "503" || err?.message?.includes("503")) {
          retries--;
          if (retries > 0) {
            console.log(`[Server] Waiting before retry...`);
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
        } else {
          break;
        }
      }
    }
  }
  throw new Error(`All models failed.
Details:
${errors.join("\n")}`);
}
function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.API_KEY || "";
}
function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY || "";
}
function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY || "";
}
function getDeepSeekApiKey() {
  return process.env.DEEPSEEK_API_KEY || "";
}
function getAdminProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const parsed = JSON.parse(process.env.VITE_FIREBASE_CONFIG || "{}");
    if (parsed?.projectId) return parsed.projectId;
  } catch {
  }
  return import_firebase_applet_config.default?.projectId || "";
}
function getAdminApp() {
  if (getApps2().length > 0) return getApp();
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    try {
      const parsed = JSON.parse(serviceAccountStr);
      return initializeApp2({ credential: cert(parsed) });
    } catch {
      console.warn("[Firebase Admin] Failed to parse service account");
    }
  }
  const projectId = getAdminProjectId();
  if (projectId) {
    console.warn(
      `[Firebase Admin] Brak FIREBASE_SERVICE_ACCOUNT \u2014 weryfikuj\u0119 tokeny samym ID projektu (${projectId}). Wystarczy do ochrony tras /api; operacje wymagaj\u0105ce uprawnie\u0144 administratora b\u0119d\u0105 niedost\u0119pne.`
    );
    return initializeApp2({ projectId });
  }
  console.error("[Firebase Admin] Brak konta us\u0142ugi i ID projektu \u2014 trasy /api b\u0119d\u0105 odrzuca\u0107 wszystkie \u017C\u0105dania.");
  return initializeApp2();
}
function createApp() {
  const app2 = express();
  app2.use((req, res, next) => {
    const forwardPath = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"] || req.headers["x-original-url"];
    if (forwardPath && forwardPath.startsWith("/api") && (req.url === "/api" || req.url === "/api/" || req.url.startsWith("/api?"))) {
      req.url = forwardPath;
    }
    next();
  });
  app2.use(express.json({ limit: "50mb" }));
  app2.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Payload too large" });
    }
    next(err);
  });
  const adminApp = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const FIRESTORE_DATABASE_ID = "ai-studio-520a4841-33d0-41ef-829a-838ebc44072d";
  if (adminApp) {
    (async () => {
      try {
        const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
        const snap = await adminDb.collection("system").doc("ai").get();
        const keys = (snap.exists ? snap.data()?.keys : null) || {};
        const mapping = {
          openai: "OPENAI_API_KEY",
          gemini: "GEMINI_API_KEY",
          elevenlabs: "ELEVENLABS_API_KEY"
        };
        for (const [provider, envName] of Object.entries(mapping)) {
          const stored = String(keys[provider] || "").trim();
          if (stored) {
            process.env[envName] = stored;
            console.log(`[AI] Klucz ${provider} wczytany z ustawie\u0144 aplikacji (${maskKey(stored)}).`);
          }
        }
      } catch (e) {
        console.warn("[AI] Nie uda\u0142o si\u0119 wczyta\u0107 kluczy z bazy:", e);
      }
    })();
  }
  async function optionalFirebaseAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.slice(7).trim();
      if (idToken && idToken !== "null" && idToken !== "undefined") {
        try {
          const decodedToken = await adminAuth.verifyIdToken(idToken);
          req.userUid = decodedToken.uid;
          req.userEmail = decodedToken.email;
        } catch (err) {
          console.warn("Optional auth token verification failed:", err.message);
        }
      }
    }
    next();
  }
  async function requireFirebaseAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing Bearer token" });
      return;
    }
    const idToken = authHeader.slice(7).trim();
    if (!idToken || idToken === "null" || idToken === "undefined") {
      res.status(401).json({ error: "Missing or empty Bearer token" });
      return;
    }
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      req.userUid = decodedToken.uid;
      req.userEmail = decodedToken.email;
      next();
    } catch (err) {
      console.warn("Auth token verification failed:", err.message);
      res.status(401).json({ error: "Invalid or expired token" });
    }
  }
  async function requireFirebaseAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing Bearer token" });
      return;
    }
    const idToken = authHeader.slice(7).trim();
    if (!idToken || idToken === "null" || idToken === "undefined") {
      res.status(401).json({ error: "Missing or empty Bearer token" });
      return;
    }
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const ADMIN_EMAILS = [
        "maciej.wyrozumski@gmail.com",
        "marta.lukaszczyk@gmail.com",
        "maciejwyrozumski@icloud.com",
        "wyrozumski@maciej.pro",
        "maciej@learnwithmaciej.com"
      ];
      const email = (decodedToken.email || "").toLowerCase();
      const isAdminByEmail = ADMIN_EMAILS.includes(email);
      const isAdminByClaim = decodedToken.role === "admin" || decodedToken.admin === true || decodedToken.role === "teacher";
      if (!isAdminByEmail && !isAdminByClaim) {
        try {
          const adminApp2 = getAdminApp();
          const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
          const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
          const role = userDoc.data()?.role;
          if (role !== "admin" && role !== "teacher") {
            res.status(403).json({ error: "Forbidden: Admin access required" });
            return;
          }
        } catch {
          if (!isAdminByEmail) {
            res.status(403).json({ error: "Forbidden: Admin access required" });
            return;
          }
        }
      }
      req.adminUid = decodedToken.uid;
      next();
    } catch (err) {
      console.warn("Admin Auth token verification failed:", err.message);
      res.status(401).json({ error: "Invalid or expired token" });
    }
  }
  app2.get("/api/admin-users/users", requireFirebaseAdmin, async (req, res) => {
    try {
      const listUsersResult = await adminAuth.listUsers(1e3);
      res.json(listUsersResult.users);
    } catch (error) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.post("/api/admin-users/users", requireFirebaseAdmin, async (req, res) => {
    try {
      const { email, password, role, username, displayName, firstName, lastName, ...extraData } = req.body;
      const cleanEmail = String(email || "").trim().toLowerCase();
      const resolvedDisplayName = displayName || username || (firstName && lastName ? `${firstName} ${lastName}`.trim() : cleanEmail.split("@")[0]);
      const nameParts = (resolvedDisplayName || "").split(" ");
      const resolvedFirst = firstName || (nameParts[0] || resolvedDisplayName);
      const resolvedLast = lastName || (nameParts.slice(1).join(" ") || "");
      const cleanUsername = username || resolvedDisplayName;
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email: cleanEmail,
          password,
          displayName: resolvedDisplayName
        });
      } catch (authError) {
        if (authError.code === "auth/email-already-exists") {
          userRecord = await adminAuth.getUserByEmail(cleanEmail);
          if (password) {
            await adminAuth.updateUser(userRecord.uid, { password });
          }
        } else {
          throw authError;
        }
      }
      if (role) {
        await adminAuth.setCustomUserClaims(userRecord.uid, { role });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const newUserDoc = {
        email: cleanEmail,
        username: cleanUsername,
        displayName: resolvedDisplayName,
        firstName: resolvedFirst,
        lastName: resolvedLast,
        role: role || "user",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        loginCount: 0,
        streakCount: 0,
        requirePasswordChange: true,
        tempPassword: password,
        statusWspolpracy: "Aktywny",
        ...extraData
      };
      await adminDb.collection("users").doc(userRecord.uid).set(newUserDoc, { merge: true });
      res.json({
        ...userRecord,
        uid: userRecord.uid,
        email: cleanEmail,
        userDoc: newUserDoc
      });
    } catch (error) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.delete("/api/admin-users/users/:uid", requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid;
      await adminAuth.deleteUser(uid);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.post("/api/admin-users/users/:uid/password", requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid;
      const { password } = req.body;
      await adminAuth.updateUser(uid, { password });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.post("/api/admin-users/users/:uid/role", requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid;
      const { role } = req.body;
      await adminAuth.setCustomUserClaims(uid, { role });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.post("/api/admin-users/users/:uid/email", requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid;
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Nieprawid\u0142owy adres e-mail." });
      }
      const trimmedEmail = email.trim().toLowerCase();
      try {
        await adminAuth.updateUser(uid, { email: trimmedEmail });
      } catch (authErr) {
        console.warn(`[Admin User Email] Auth update warning for ${uid}:`, authErr?.message);
        if (authErr?.code === "auth/email-already-exists") {
          return res.status(400).json({ error: "Ten adres e-mail jest ju\u017C przypisany do innego konta w systemie." });
        }
        if (authErr?.code === "auth/invalid-email") {
          return res.status(400).json({ error: "Podano nieprawid\u0142owy format adresu e-mail." });
        }
      }
      try {
        const adminApp2 = getAdminApp();
        const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
        await adminDb.collection("users").doc(uid).set({
          email: trimmedEmail
        }, { merge: true });
      } catch (dbErr) {
        console.warn(`[Admin User Email] Firestore admin update warning for ${uid}:`, dbErr?.message);
      }
      res.json({ success: true, email: trimmedEmail });
    } catch (error) {
      console.error("[Admin User Email Error]:", error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  function normalizeUsername(username) {
    return (username || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]/g, "").slice(0, 30) || "student";
  }
  app2.post("/api/admin-users/bulk-import", requireFirebaseAdmin, async (req, res) => {
    try {
      const { students } = req.body;
      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ error: "Brak listy kursant\xF3w do zaimportowania." });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const results = [];
      for (const item of students) {
        try {
          const rawFirst = String(item.firstName || "").trim();
          const rawLast = String(item.lastName || "").trim();
          const rawUsername = String(item.username || "").trim();
          let displayName = "";
          if (rawFirst || rawLast) {
            displayName = `${rawFirst} ${rawLast}`.trim();
          } else if (rawUsername) {
            displayName = rawUsername;
          } else {
            displayName = "Kursant";
          }
          const cleanUsername = rawUsername || displayName;
          const rawEmail = String(item.email || "").trim().toLowerCase();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const finalEmail = rawEmail && emailRegex.test(rawEmail) ? rawEmail : `${normalizeUsername(cleanUsername)}@student.vocabboost.com`;
          const rawPassword = String(item.password || "").trim();
          const finalPassword = rawPassword.length >= 6 ? rawPassword : Math.random().toString(36).slice(-8);
          let userRecord;
          let status = "created";
          try {
            userRecord = await adminAuth.createUser({
              email: finalEmail,
              password: finalPassword,
              displayName: displayName || cleanUsername
            });
          } catch (authErr) {
            if (authErr?.code === "auth/email-already-exists") {
              userRecord = await adminAuth.getUserByEmail(finalEmail);
              status = "existing";
              if (rawPassword) {
                await adminAuth.updateUser(userRecord.uid, { password: finalPassword });
              }
            } else {
              throw authErr;
            }
          }
          const newUserDoc = {
            email: finalEmail,
            username: cleanUsername,
            displayName,
            firstName: rawFirst || (displayName.includes(" ") ? displayName.split(" ")[0] : displayName),
            lastName: rawLast || (displayName.includes(" ") ? displayName.split(" ").slice(1).join(" ") : ""),
            role: "user",
            level: item.level || "A2-B1",
            company: item.company || "",
            notes: item.notes || "",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            loginCount: 0,
            streakCount: 0,
            requirePasswordChange: true,
            tempPassword: finalPassword,
            statusWspolpracy: "Aktywny"
          };
          await adminDb.collection("users").doc(userRecord.uid).set(newUserDoc, { merge: true });
          results.push({
            uid: userRecord.uid,
            username: cleanUsername,
            email: finalEmail,
            password: finalPassword,
            status
          });
        } catch (itemErr) {
          console.error("[Bulk Import Item Error]:", itemErr);
          results.push({
            username: item.username || item.firstName || "Nieznany",
            email: item.email || "",
            status: "error",
            error: formatErrorString(itemErr)
          });
        }
      }
      const createdCount = results.filter((r) => r.status === "created").length;
      const existingCount = results.filter((r) => r.status === "existing").length;
      const errorCount = results.filter((r) => r.status === "error").length;
      res.json({
        total: students.length,
        created: createdCount,
        existing: existingCount,
        failed: errorCount,
        results
      });
    } catch (error) {
      console.error("[Bulk Import Error]:", error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.post("/api/web-research/scrape", requireFirebaseAuth, async (req, res) => {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== "string" || !url.startsWith("http://") && !url.startsWith("https://")) {
        return res.status(400).json({ error: "Nieprawid\u0142owy adres URL. Wymagany protok\xF3\u0142 http:// lub https://" });
      }
      console.log(`[Web Scraping] Fetching URL: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12e3);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 CRIBRO/1.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
          "Accept-Language": "pl,en-US;q=0.9,en;q=0.8"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        return res.status(response.status).json({
          error: `Strona odpowiedzia\u0142a kodem ${response.status}: ${response.statusText}`
        });
      }
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "Strona WWW";
      let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ").replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ").replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ").replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ").replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ").replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
      cleaned = cleaned.replace(/<h[1-6][^>]*>/gi, "\n\n### ").replace(/<\/h[1-6]>/gi, "\n").replace(/<p[^>]*>/gi, "\n\n").replace(/<\/p>/gi, "").replace(/<br\s*[\/]?>/gi, "\n").replace(/<li[^>]*>/gi, "\n* ").replace(/<\/li>/gi, "").replace(/<tr[^>]*>/gi, "\n").replace(/<td[^>]*>/gi, " | ").replace(/<th[^>]*>/gi, " | ");
      cleaned = cleaned.replace(/<[^>]+>/g, " ");
      cleaned = cleaned.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x2F;/g, "/");
      const formattedText = cleaned.split("\n").map((line) => line.trim()).filter(Boolean).join("\n\n").slice(0, 15e3);
      res.json({
        url,
        title,
        textContent: formattedText,
        length: formattedText.length
      });
    } catch (error) {
      console.error("[Web Scraping Error]:", error);
      res.status(500).json({ error: `Nie uda\u0142o si\u0119 pobra\u0107 strony: ${formatErrorString(error)}` });
    }
  });
  const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || "cribro-recall-opt-out-secret-2026";
  const generateUnsubscribeToken = (uid) => {
    return createHmac("sha256", UNSUBSCRIBE_SECRET).update(uid).digest("hex").slice(0, 16);
  };
  app2.post("/api/unsubscribe", async (req, res) => {
    try {
      const { uid, token, action } = req.body;
      if (!uid || typeof uid !== "string") {
        return res.status(400).json({ error: "Brak identyfikatora u\u017Cytkownika." });
      }
      const expectedToken = generateUnsubscribeToken(uid);
      if (!token || token !== expectedToken) {
        return res.status(403).json({ error: "Nieprawid\u0142owy lub wygas\u0142y token wypisania." });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: "Konto kursanta nie zosta\u0142o odnalezione." });
      }
      const userData = userSnap.data() || {};
      const isReSubscribing = action === "resubscribe";
      if (isReSubscribing) {
        await userRef.update({
          emailNotificationsDisabled: false,
          unsubscribedAt: null
        });
        return res.json({
          ok: true,
          status: "subscribed",
          email: userData.email,
          name: userData.firstName || userData.username || "Kursancie"
        });
      }
      await userRef.update({
        emailNotificationsDisabled: true,
        unsubscribedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return res.json({
        ok: true,
        status: "unsubscribed",
        email: userData.email,
        name: userData.firstName || userData.username || "Kursancie"
      });
    } catch (err) {
      console.error("[Unsubscribe API Error]:", err);
      return res.status(500).json({ error: "B\u0142\u0105d zapisu preferencji powiadomie\u0144: " + formatErrorString(err) });
    }
  });
  app2.get("/api/homework/direct/:token", async (req, res) => {
    try {
      const token = String(req.params.token || req.query.token || "").trim();
      if (!token) {
        return res.status(400).json({ error: "missing_token", message: "Brak tokenu dost\u0119powego." });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      let taskSnap = await adminDb.collection("specialTasks").where("accessToken", "==", token).limit(1).get();
      if (taskSnap.empty && token.length > 8) {
        const directDoc = await adminDb.collection("specialTasks").doc(token).get();
        if (directDoc.exists) {
          const dData = directDoc.data();
          if (dData?.accessToken === token || !dData?.accessToken) {
            taskSnap = { empty: false, docs: [directDoc] };
          }
        }
      }
      if (taskSnap.empty) {
        return res.status(404).json({
          error: "not_found",
          message: "Nie znaleziono zadania dla podanego linku. M\xF3g\u0142 zosta\u0107 usuni\u0119ty lub zast\u0105piony nowym."
        });
      }
      const taskDoc = taskSnap.docs[0];
      const taskData = taskDoc.data() || {};
      if (taskData.accessExpiresAt) {
        const expiresTime = new Date(taskData.accessExpiresAt).getTime();
        if (expiresTime < Date.now()) {
          return res.status(410).json({
            error: "expired",
            message: "Link do tego zadania straci\u0142 wa\u017Cno\u015B\u0107. Skontaktuj si\u0119 ze swoim lektorem, aby otrzyma\u0107 zaktualizowany dost\u0119p.",
            expiresAt: taskData.accessExpiresAt
          });
        }
      }
      let studentDisplayName = taskData.studentName || "Kursancie";
      const studentUid = taskData.studentUid || taskData.studentId;
      if (studentUid) {
        try {
          const userDoc = await adminDb.collection("users").doc(studentUid).get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            studentDisplayName = uData?.firstName || uData?.username || studentDisplayName;
          }
        } catch (e) {
          console.warn("[Direct Homework] Nie uda\u0142o si\u0119 pobra\u0107 danych kursanta:", e);
        }
      }
      const safeSentences = (taskData.sentences || []).map((s, idx) => ({
        id: s.id || `s-${idx}`,
        type: s.type || taskData.type || "translation",
        polishSentence: s.polishSentence || s.prompt || "",
        polishHint: s.polishHint || s.hint || "",
        // Dla word_order udostępniamy rozsypankę słowną:
        chunks: s.chunks || (s.englishTranslation ? s.englishTranslation.split(" ").sort(() => Math.random() - 0.5) : []),
        // Dla multiple_choice:
        question: s.question || s.polishSentence || "",
        options: s.options || [],
        // Dla fill_in_the_blank:
        textWithBlanks: s.textWithBlanks || "",
        blanks: s.blanks || [],
        availableWords: s.availableWords || (s.blanks && typeof s.blanks === "object" && !Array.isArray(s.blanks) ? Object.values(s.blanks).sort(() => Math.random() - 0.5) : []),
        // Dla find_errors:
        incorrectSentence: s.incorrectSentence || "",
        hint: s.hint || "",
        explanation: s.explanation || ""
      }));
      const isAlreadySubmitted = taskData.status === "submitted" || taskData.status === "graded" || taskData.status === "completed";
      return res.json({
        ok: true,
        task: {
          id: taskDoc.id,
          title: taskData.title || "Praca domowa",
          type: taskData.type || "translation",
          types: taskData.types || (taskData.type ? [taskData.type] : []),
          instructions: taskData.instructions || "",
          dueDate: taskData.dueDate || "",
          status: taskData.status || "pending",
          studentName: studentDisplayName,
          studentId: studentUid,
          sentences: safeSentences,
          studentAnswers: isAlreadySubmitted ? taskData.studentAnswers : void 0,
          evaluationResults: isAlreadySubmitted ? taskData.evaluationResults : void 0,
          submittedAt: taskData.submittedAt || null,
          accessExpiresAt: taskData.accessExpiresAt || null,
          isAlreadySubmitted
        }
      });
    } catch (err) {
      console.error("[Direct Homework GET Error]:", err);
      return res.status(500).json({ error: "server_error", message: "Wyst\u0105pi\u0142 b\u0142\u0105d podczas \u0142adowania pracy domowej: " + formatErrorString(err) });
    }
  });
  app2.post("/api/homework/direct-submit", async (req, res) => {
    try {
      const { token, answers } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "missing_token", message: "Brak tokenu dost\u0119powego." });
      }
      if (!answers || typeof answers !== "object") {
        return res.status(400).json({ error: "missing_answers", message: "Brak udzielonych odpowiedzi do oceny." });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const taskSnap = await adminDb.collection("specialTasks").where("accessToken", "==", token.trim()).limit(1).get();
      if (taskSnap.empty) {
        return res.status(404).json({ error: "not_found", message: "Nie znaleziono zadania dla podanego tokenu." });
      }
      const taskDoc = taskSnap.docs[0];
      const taskData = taskDoc.data() || {};
      if (taskData.accessExpiresAt) {
        const expiresTime = new Date(taskData.accessExpiresAt).getTime();
        if (expiresTime < Date.now()) {
          return res.status(410).json({
            error: "expired",
            message: "Termin wa\u017Cno\u015Bci tego linku min\u0105\u0142. Skontaktuj si\u0119 z lektorem.",
            expiresAt: taskData.accessExpiresAt
          });
        }
      }
      if (taskData.status === "submitted" || taskData.status === "graded") {
        return res.status(400).json({
          error: "already_submitted",
          message: "Ta praca domowa zosta\u0142a ju\u017C wcze\u015Bniej oddana.",
          submittedAt: taskData.submittedAt
        });
      }
      const items = taskData.sentences || [];
      const normalizeSimple = (str) => String(str || "").toLowerCase().replace(/[.,!?;:"„”]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
      const rows = [];
      const storedAnswers = {};
      items.forEach((item, i) => {
        const itemType = item.type || taskData.type || "translation";
        const rawAns = answers[i];
        storedAnswers[i] = rawAns;
        let isCorrect = false;
        let score = 0;
        let expectedStr = item.englishTranslation || item.correctSentence || "";
        let studentStr = "";
        if (itemType === "word_order") {
          if (Array.isArray(rawAns)) {
            studentStr = rawAns.map((idx) => item.chunks?.[idx]).filter(Boolean).join(" ");
          } else {
            studentStr = String(rawAns || "");
          }
          if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
            isCorrect = true;
            score = 100;
          }
        } else if (itemType === "multiple_choice") {
          studentStr = typeof rawAns === "number" ? item.options?.[rawAns] || "" : String(rawAns || "");
          const expectedOption = typeof item.correctOptionIndex === "number" ? item.options?.[item.correctOptionIndex] : item.options?.[0] || "";
          expectedStr = expectedOption;
          if (rawAns === item.correctOptionIndex || normalizeSimple(studentStr) === normalizeSimple(expectedOption)) {
            isCorrect = true;
            score = 100;
          }
        } else if (itemType === "fill_in_the_blank") {
          const blanksObj = typeof rawAns === "object" && rawAns !== null ? rawAns : {};
          studentStr = Object.keys(blanksObj).sort().map((k) => `${k}: ${blanksObj[k]}`).join(", ");
          let totalBlanks = item.blanks?.length || 1;
          let correctBlanks = 0;
          if (item.blanks && Array.isArray(item.blanks)) {
            item.blanks.forEach((b) => {
              const expectedVal = normalizeSimple(b.correctAnswer || b.word || b.answer || "");
              const userVal = normalizeSimple(blanksObj[b.id] || blanksObj[`BLANK_${b.id}`] || "");
              if (expectedVal && userVal && (expectedVal === userVal || userVal.includes(expectedVal))) {
                correctBlanks++;
              }
            });
          }
          score = Math.round(correctBlanks / totalBlanks * 100);
          isCorrect = score >= 80;
        } else if (itemType === "find_errors") {
          studentStr = String(rawAns || "").trim();
          expectedStr = item.correctSentence || "";
          if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
            isCorrect = true;
            score = 100;
          } else if (normalizeSimple(studentStr).length > 5) {
            score = 70;
            isCorrect = true;
          }
        } else {
          studentStr = String(rawAns || "").trim();
          expectedStr = item.englishTranslation || "";
          if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
            isCorrect = true;
            score = 100;
          } else if (normalizeSimple(studentStr).length > 3) {
            score = 75;
            isCorrect = true;
          }
        }
        rows.push({
          polishSentence: item.polishSentence || item.prompt || "",
          correctTranslation: expectedStr,
          studentAnswer: studentStr || rawAns,
          isCorrect,
          score,
          explanation: item.explanation || void 0
        });
      });
      const averageScore = rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : 0;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      await taskDoc.ref.update({
        status: "submitted",
        studentAnswers: storedAnswers,
        evaluationResults: rows,
        submittedAt: nowIso,
        submittedViaDirectLink: true,
        updatedAt: nowIso
      });
      const studentUid = taskData.studentUid || taskData.studentId;
      if (studentUid) {
        try {
          await adminDb.collection("users").doc(studentUid).collection("practiceLogs").add({
            exerciseType: "homework",
            exerciseFormat: taskData.type || "mixed",
            date: nowIso,
            isRevisionMode: false,
            score: averageScore,
            totalWords: items.length,
            setDisplayName: taskData.title || "Praca domowa",
            exercisesData: rows,
            submittedViaDirectLink: true,
            taskId: taskDoc.id
          });
          await adminDb.collection("users").doc(studentUid).update({
            hasNewHomework: false,
            lastHomeworkSubmittedAt: nowIso,
            lastActivity: nowIso
          }).catch(() => {
          });
          try {
            const profileDocRef = adminDb.collection("users").doc(studentUid).collection("profile").doc("learningCurve");
            const [profileSnap, userSnap] = await Promise.all([
              profileDocRef.get(),
              adminDb.collection("users").doc(studentUid).get()
            ]);
            const baseLevel = normalizeLevel(userSnap.data()?.level);
            const currentProfile = profileSnap.exists ? deserializeLearningProfile(studentUid, profileSnap.data() || {}, baseLevel) : createProfile(studentUid, baseLevel, nowIso);
            const attempts = rows.map((r, idx) => ({
              prompt: r.polishSentence || items[idx]?.polishSentence || "",
              expected: r.correctTranslation || items[idx]?.englishTranslation || "",
              given: r.studentAnswer || "",
              isCorrect: r.isCorrect,
              score: r.score,
              level: baseLevel,
              exerciseType: items[idx]?.type || taskData.type || "homework",
              date: nowIso
            }));
            const { profile } = ingestAttempts(currentProfile, attempts, nowIso);
            await profileDocRef.set(serializeLearningProfile(profile, currentProfile.createdAt || nowIso));
          } catch (lcErr) {
            console.warn("[Direct Homework] B\u0142\u0105d aktualizacji profilu krzywej uczenia:", lcErr);
          }
        } catch (dbErr) {
          console.warn("[Direct Homework] B\u0142\u0105d zapisu do profilu kursanta:", dbErr);
        }
      }
      return res.json({
        ok: true,
        score: averageScore,
        rows,
        submittedAt: nowIso,
        studentName: taskData.studentName || "Kursancie"
      });
    } catch (err) {
      console.error("[Direct Homework Submit Error]:", err);
      return res.status(500).json({ error: "server_error", message: "Wyst\u0105pi\u0142 b\u0142\u0105d podczas wysy\u0142ania pracy domowej: " + formatErrorString(err) });
    }
  });
  app2.get("/api/mailing/status", requireFirebaseAdmin, async (_req, res) => {
    try {
      let dbKey = null;
      let enableBccSender = true;
      let bccEmail = "wyrozumski@maciej.pro";
      let dbFromAddress = null;
      if (adminApp) {
        try {
          const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
          const mailingDoc = await adminDb.collection("system").doc("mailing").get();
          if (mailingDoc.exists) {
            const data = mailingDoc.data();
            if (data?.resendApiKey) {
              dbKey = String(data.resendApiKey).trim();
            }
            if (typeof data?.enableBccSender === "boolean") {
              enableBccSender = data.enableBccSender;
            }
            if (data?.bccEmail && typeof data.bccEmail === "string") {
              bccEmail = data.bccEmail.trim();
            }
            if (data?.senderEmail) {
              const name = data.senderName || "Maciej Wyrozumski";
              dbFromAddress = `${name} <${data.senderEmail}>`;
            }
          }
        } catch {
        }
      }
      const envKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : null;
      const activeKey = envKey || dbKey;
      const maskedKey = activeKey ? `${activeKey.slice(0, 6)}\u2022\u2022\u2022\u2022${activeKey.slice(-4)}` : null;
      return res.json({
        configured: !!activeKey,
        hasEnvKey: !!envKey,
        hasDbKey: !!dbKey,
        maskedKey,
        fromAddress: dbFromAddress || process.env.FROM_ADDRESS || "Maciej Wyrozumski <wyrozumski@maciej.pro>",
        enableBccSender,
        bccEmail
      });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/homework-v2/generate", requireFirebaseAuth, async (req, res) => {
    try {
      const studentUid = String(req.body?.studentUid || "").trim();
      if (!studentUid) return res.status(400).json({ error: "Nie wskazano kursanta." });
      const lessonIds = Array.isArray(req.body?.lessonIds) ? req.body.lessonIds : [];
      if (lessonIds.length === 0) return res.status(400).json({ error: "Nie wskazano lekcji." });
      const itemCount = Number(req.body?.itemCount) || 6;
      const plannedMinutes = Number(req.body?.plannedMinutes) || 0;
      const requestedTypes = req.body?.types;
      const teacherId = req.userUid;
      const rawLessons = Array.isArray(req.body?.rawLessons) ? req.body.rawLessons : void 0;
      let cefr = String(req.body?.cefr || "B1");
      let recentMistakes = [];
      try {
        const adminApp2 = getAdminApp();
        const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
        const studentSnap = await adminDb.collection("users").doc(studentUid).get();
        if (studentSnap.exists) {
          cefr = String(studentSnap.data()?.level || cefr);
        }
        recentMistakes = await getRecentMistakes(studentUid);
      } catch (dbErr) {
        console.warn("[server] pomijam zapytanie Admin DB przy generowaniu prac domowych v2:", dbErr);
      }
      const context = await assembleContext({
        studentUid,
        lessonIds,
        cefr,
        recentMistakes,
        rawLessons
      });
      const plan = planExercises({ context, requestedTypes, itemCount, plannedMinutes });
      const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
      const openAiKey = (process.env.OPENAI_API_KEY || "").trim();
      const aiCall = createAiCall({
        geminiApiKey: geminiKey,
        openAiApiKey: openAiKey
      });
      const result = await buildExerciseSet({
        context,
        plan,
        call: aiCall,
        teacherId,
        studentId: studentUid
      });
      return res.json({
        exercises: result.exercises,
        warnings: result.warnings,
        needsReviewCount: result.needsReviewCount,
        schemaVersion: SCHEMA_VERSION
      });
    } catch (err) {
      console.error("[server] b\u0142\u0105d generowania pracy domowej v2:", err);
      return res.status(500).json({ error: err?.message || "Nie uda\u0142o si\u0119 u\u0142o\u017Cy\u0107 zestawu." });
    }
  });
  app2.post("/api/homework-v2/assign", requireFirebaseAuth, async (req, res) => {
    try {
      const rawExercises = Array.isArray(req.body?.exercises) ? req.body.exercises : [];
      const studentUids = Array.isArray(req.body?.studentUids) ? req.body.studentUids : [];
      const studentNames = typeof req.body?.studentNames === "object" && req.body?.studentNames !== null ? req.body.studentNames : {};
      const studentEmails = typeof req.body?.studentEmails === "object" && req.body?.studentEmails !== null ? req.body.studentEmails : {};
      const studentUsernames = typeof req.body?.studentUsernames === "object" && req.body?.studentUsernames !== null ? req.body.studentUsernames : {};
      const title = String(req.body?.title || "Praca domowa").trim();
      const dueDate = String(req.body?.dueDate || "").trim();
      const groupId = String(req.body?.groupId || "").trim();
      const teacherId = req.userUid;
      if (studentUids.length === 0) return res.status(400).json({ error: "Nie wskazano kursant\xF3w." });
      const exercises = selectSendableExercises(rawExercises);
      if (exercises.length === 0) {
        return res.status(400).json({ error: "\u017Badne z zada\u0144 nie nadaje si\u0119 do wys\u0142ania." });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const homeworkSetId = newHomeworkSetId();
      const created = [];
      for (const studentUid of studentUids) {
        const payload = buildV2TaskPayload({
          studentUid,
          studentName: studentNames[studentUid],
          studentEmail: studentEmails[studentUid],
          studentUsername: studentUsernames[studentUid],
          exercises,
          teacherId,
          title,
          dueDate,
          groupId,
          homeworkSetId,
          createdAt: nowIso
        });
        const ref = await adminDb.collection("specialTasks").add(payload);
        created.push(ref.id);
        try {
          await adminDb.collection("users").doc(studentUid).update({ hasNewHomework: true });
        } catch {
        }
      }
      return res.json({ taskIds: created, homeworkSetId, assignedCount: exercises.length });
    } catch (err) {
      console.error("[server] b\u0142\u0105d przypisywania pracy domowej v2:", err);
      return res.status(500).json({ error: err?.message || "Nie uda\u0142o si\u0119 przypisa\u0107 zestawu." });
    }
  });
  const AI_KEY_ENV = {
    openai: "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
    elevenlabs: "ELEVENLABS_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    deepseek: "DEEPSEEK_API_KEY"
  };
  const maskKey = (key) => key.length <= 10 ? "\u2022\u2022\u2022\u2022" : `${key.slice(0, 6)}\u2022\u2022\u2022\u2022${key.slice(-4)}`;
  const AI_SETTINGS_FILE = path.resolve(process.cwd(), ".ai-settings.json");
  const readAiSettings = async () => {
    let firestoreData = null;
    if (adminApp) {
      try {
        const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
        const snap = await adminDb.collection("system").doc("ai").get();
        if (snap.exists && snap.data()) {
          firestoreData = snap.data();
        }
      } catch (e) {
      }
    }
    let localData = null;
    try {
      if (fs.existsSync(AI_SETTINGS_FILE)) {
        localData = JSON.parse(fs.readFileSync(AI_SETTINGS_FILE, "utf8"));
      }
    } catch {
    }
    return { ...localData || {}, ...firestoreData || {} };
  };
  app2.get("/api/ai/config", requireFirebaseAuth, async (_req, res) => {
    try {
      const settings = await readAiSettings();
      const keys = {};
      for (const [provider, envName] of Object.entries(AI_KEY_ENV)) {
        const fromEnv = (process.env[envName] || "").trim();
        const fromApp = String(settings?.keys?.[provider] || "").trim();
        const effective = fromApp || fromEnv;
        keys[provider] = effective ? { configured: true, maskedKey: maskKey(effective), source: fromApp ? "app" : "env" } : { configured: false };
      }
      return res.json({ models: settings?.models || {}, council: settings?.council || null, keys });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/ai/config", requireFirebaseAdmin, async (req, res) => {
    try {
      const { models, council } = req.body || {};
      if ((!models || typeof models !== "object") && !council) {
        return res.status(400).json({ error: "Brak wyboru modeli do zapisania." });
      }
      const allowedTasks = ["exercises", "grading", "chat", "summaries"];
      const allowedModels = [
        "openai/gpt-5.6-luna",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "openai/o3-mini",
        "gemini-2.5-flash",
        "gemini-3.8-flash",
        "gemini-2.5-pro",
        "anthropic/claude-3-7-sonnet",
        "anthropic/claude-3-5-sonnet",
        "anthropic/claude-3-5-haiku",
        "deepseek/deepseek-chat",
        "deepseek/deepseek-reasoner"
      ];
      const clean = {};
      for (const [task, model] of Object.entries(models || {})) {
        if (!allowedTasks.includes(task)) continue;
        if (typeof model !== "string" || !allowedModels.includes(model)) continue;
        clean[task] = model;
      }
      let cleanCouncil = void 0;
      if (council && typeof council === "object") {
        const seatsIn = Array.isArray(council.seats) ? council.seats.slice(0, 4) : [];
        cleanCouncil = {
          enabled: Boolean(council.enabled),
          seats: seatsIn.map((seat, index) => ({
            id: `seat-${index + 1}`,
            model: allowedModels.includes(String(seat?.model)) ? String(seat.model) : allowedModels[0],
            role: index === 0 ? "author" : "reviewer",
            enabled: index === 0 ? true : Boolean(seat?.enabled)
          }))
        };
      }
      try {
        let currentData = {};
        if (fs.existsSync(AI_SETTINGS_FILE)) {
          currentData = JSON.parse(fs.readFileSync(AI_SETTINGS_FILE, "utf8"));
        }
        const updated = {
          ...currentData,
          ...models ? { models: clean } : {},
          ...cleanCouncil ? { council: cleanCouncil } : {},
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        fs.writeFileSync(AI_SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf8");
      } catch (e) {
        console.warn("Nie uda\u0142o si\u0119 zapisa\u0107 wyboru modeli do .ai-settings.json:", e);
      }
      if (adminApp) {
        try {
          const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection("system").doc("ai").set(
            {
              ...models ? { models: clean } : {},
              ...cleanCouncil ? { council: cleanCouncil } : {},
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn("[AI] Nie uda\u0142o si\u0119 zapisa\u0107 konfiguracji do Firestore (brak po\u015Bwiadcze\u0144 Admin):", dbErr);
        }
      }
      return res.json({ ok: true, models: clean, council: cleanCouncil });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/ai/save-key", requireFirebaseAdmin, async (req, res) => {
    try {
      const { provider, apiKey } = req.body || {};
      const envName = AI_KEY_ENV[String(provider)];
      if (!envName) {
        return res.status(400).json({ error: "Nieznany dostawca klucza." });
      }
      if (typeof apiKey !== "string" || apiKey.trim().length < 12) {
        return res.status(400).json({ error: "Podaj pe\u0142ny klucz API." });
      }
      const cleanKey = apiKey.trim();
      process.env[envName] = cleanKey;
      if (provider === "gemini") {
        process.env.VITE_GEMINI_API_KEY = cleanKey;
      }
      try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, "utf8");
          const regex = new RegExp(`${envName}=.*(\\r?\\n|$)`);
          if (content.includes(`${envName}=`)) {
            content = content.replace(regex, `${envName}=${cleanKey}
`);
          } else {
            content += `
${envName}=${cleanKey}
`;
          }
          if (provider === "gemini") {
            if (content.includes("VITE_GEMINI_API_KEY=")) {
              content = content.replace(/VITE_GEMINI_API_KEY=.*(\r?\n|$)/, `VITE_GEMINI_API_KEY=${cleanKey}
`);
            }
          }
          fs.writeFileSync(envPath, content, "utf8");
        }
      } catch (e) {
        console.warn(`Nie uda\u0142o si\u0119 zapisa\u0107 ${envName} w .env:`, e);
      }
      try {
        let currentData = {};
        if (fs.existsSync(AI_SETTINGS_FILE)) {
          currentData = JSON.parse(fs.readFileSync(AI_SETTINGS_FILE, "utf8"));
        }
        const updated = {
          ...currentData,
          keys: { ...currentData.keys || {}, [String(provider)]: cleanKey },
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        fs.writeFileSync(AI_SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf8");
      } catch (e) {
        console.warn("Nie uda\u0142o si\u0119 zapisa\u0107 klucza do .ai-settings.json:", e);
      }
      if (adminApp) {
        try {
          const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection("system").doc("ai").set(
            { keys: { [String(provider)]: cleanKey }, updatedAt: (/* @__PURE__ */ new Date()).toISOString() },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn("[AI] Nie uda\u0142o si\u0119 zapisa\u0107 klucza do Firestore (brak po\u015Bwiadcze\u0144 Admin):", dbErr);
        }
      }
      return res.json({ ok: true, maskedKey: maskKey(cleanKey) });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/mailing/save-key", requireFirebaseAdmin, async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== "string" || !apiKey.trim().startsWith("re_")) {
        return res.status(400).json({ error: 'Podaj poprawny klucz Resend API (musi zaczyna\u0107 si\u0119 od "re_").' });
      }
      const cleanKey = apiKey.trim();
      process.env.RESEND_API_KEY = cleanKey;
      try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, "utf8");
          if (content.includes("RESEND_API_KEY=")) {
            content = content.replace(/RESEND_API_KEY=.*(\r?\n|$)/, `RESEND_API_KEY=${cleanKey}
`);
          } else {
            content += `
RESEND_API_KEY=${cleanKey}
`;
          }
          fs.writeFileSync(envPath, content, "utf8");
        }
      } catch (e) {
        console.warn("Nie uda\u0142o si\u0119 zapisa\u0107 RESEND_API_KEY do .env:", e);
      }
      if (adminApp) {
        try {
          const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection("system").doc("mailing").set({
            resendApiKey: cleanKey,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn("Nie uda\u0142o si\u0119 zapisa\u0107 resendApiKey do Firestore:", e);
        }
      }
      return res.json({
        ok: true,
        maskedKey: `${cleanKey.slice(0, 6)}\u2022\u2022\u2022\u2022${cleanKey.slice(-4)}`,
        message: "Klucz Resend API zosta\u0142 pomy\u015Blnie zapisany i uaktywniony."
      });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/homework/notify-graded", requireFirebaseAuth, async (req, res) => {
    try {
      const { studentUid, taskId, taskTitle, score, teacherFeedback, teacherName } = req.body;
      if (!studentUid) {
        return res.status(400).json({ error: "Brak studentUid." });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const userDocRef = adminDb.collection("users").doc(studentUid);
      const userSnap = await userDocRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: "Kursant nie istnieje." });
      }
      const userData = userSnap.data() || {};
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      await userDocRef.update({
        hasGradedHomework: true,
        lastGradedHomeworkId: taskId || "",
        lastGradedHomeworkTitle: taskTitle || "Praca domowa",
        lastGradedFeedback: teacherFeedback || "",
        lastGradedScore: typeof score === "number" ? score : null,
        lastGradedHomeworkSentAt: nowIso
      });
      const studentEmail = userData.email;
      if (studentEmail && studentEmail.includes("@") && !userData.emailNotificationsDisabled) {
        let apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          try {
            const mailingDoc = await adminDb.collection("system").doc("mailing").get();
            if (mailingDoc.exists && mailingDoc.data()?.resendApiKey) {
              apiKey = String(mailingDoc.data()?.resendApiKey).trim();
            }
          } catch {
          }
        }
        if (apiKey) {
          const studentName = userData.firstName || userData.name || userData.username || "";
          const emailData = buildGradedHomeworkEmail({
            studentName,
            title: taskTitle || "Praca domowa",
            score: typeof score === "number" ? score : null,
            teacherFeedback,
            gradedBy: teacherName || "Maciej Wyrozumski",
            appUrl: process.env.APP_URL || "https://app.maciej.pro"
          });
          let fromAddress = process.env.FROM_ADDRESS || "Maciej Wyrozumski <wyrozumski@maciej.pro>";
          try {
            const mailingDoc = await adminDb.collection("system").doc("mailing").get();
            if (mailingDoc.exists && mailingDoc.data()?.senderEmail) {
              fromAddress = `${mailingDoc.data()?.senderName || "Maciej Wyrozumski"} <${mailingDoc.data()?.senderEmail}>`;
            }
          } catch {
          }
          const resendPayload = {
            from: fromAddress,
            to: [studentEmail.trim()],
            reply_to: "wyrozumski@maciej.pro",
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text
          };
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey.trim()}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(resendPayload)
          });
          if (response.ok) {
            console.log(`[Graded Homework Email Sent] Do ${studentEmail} dla zadania ${taskId}`);
          } else {
            console.warn(`[Graded Homework Email Warning] Resend status ${response.status}`);
          }
        }
      }
      return res.json({ ok: true, message: "Powiadomienie zapisane i wys\u0142ane." });
    } catch (err) {
      console.error("[Notify Graded Homework Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/mailing/test-send", requireFirebaseAdmin, async (req, res) => {
    try {
      const { to, from: clientFrom, subject, html, text, apiKey: clientApiKey, replyTo, bcc: clientBcc } = req.body;
      if (!to || typeof to !== "string" || !to.includes("@")) {
        return res.status(400).json({ error: "Wymagany jest poprawny adres e-mail odbiorcy." });
      }
      let apiKey = typeof clientApiKey === "string" && clientApiKey.trim() || process.env.RESEND_API_KEY;
      if (!apiKey && adminApp) {
        try {
          const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
          const mailingDoc = await adminDb.collection("system").doc("mailing").get();
          if (mailingDoc.exists && mailingDoc.data()?.resendApiKey) {
            apiKey = String(mailingDoc.data()?.resendApiKey).trim();
          }
        } catch {
        }
      }
      if (clientApiKey && typeof clientApiKey === "string" && clientApiKey.trim().startsWith("re_")) {
        const cleanKey = clientApiKey.trim();
        process.env.RESEND_API_KEY = cleanKey;
        try {
          const envPath = path.resolve(process.cwd(), ".env");
          if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, "utf8");
            if (content.includes("RESEND_API_KEY=")) {
              content = content.replace(/RESEND_API_KEY=.*(\r?\n|$)/, `RESEND_API_KEY=${cleanKey}
`);
            } else {
              content += `
RESEND_API_KEY=${cleanKey}
`;
            }
            fs.writeFileSync(envPath, content, "utf8");
          }
        } catch (e) {
          console.warn("Nie uda\u0142o si\u0119 zapisa\u0107 RESEND_API_KEY do .env:", e);
        }
      }
      if (!apiKey) {
        return res.status(500).json({
          error: 'Brak klucza API Resend na serwerze. Wprowad\u017A klucz RESEND_API_KEY (zaczynaj\u0105cy si\u0119 od "re_") w zak\u0142adce Ustawienia lub poni\u017Cej w oknie testowym.'
        });
      }
      let fromAddress = typeof clientFrom === "string" && clientFrom.trim() || process.env.FROM_ADDRESS;
      let systemBccEmail = null;
      let systemEnableBcc = true;
      if (adminApp) {
        try {
          const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
          const mailingDoc = await adminDb.collection("system").doc("mailing").get();
          if (mailingDoc.exists) {
            const data2 = mailingDoc.data();
            if (!fromAddress && data2?.senderEmail) {
              const name = data2.senderName || "Maciej Wyrozumski";
              fromAddress = `${name} <${data2.senderEmail}>`;
            }
            if (typeof data2?.enableBccSender === "boolean") {
              systemEnableBcc = data2.enableBccSender;
            }
            if (data2?.bccEmail && typeof data2.bccEmail === "string") {
              systemBccEmail = data2.bccEmail.trim();
            }
          }
        } catch {
        }
      }
      if (!fromAddress) {
        fromAddress = "Maciej Wyrozumski <wyrozumski@maciej.pro>";
      }
      const replyToAddress = typeof replyTo === "string" && replyTo.trim() || process.env.REPLY_TO_ADDRESS || "wyrozumski@maciej.pro";
      let bccToUse = void 0;
      if (clientBcc) {
        if (Array.isArray(clientBcc)) {
          bccToUse = clientBcc.map((b) => String(b).trim()).filter((b) => b.includes("@"));
        } else if (typeof clientBcc === "string" && clientBcc.trim().includes("@")) {
          bccToUse = [clientBcc.trim()];
        }
      } else if (clientBcc !== false && systemEnableBcc && systemBccEmail && systemBccEmail.includes("@")) {
        bccToUse = [systemBccEmail];
      }
      const resendPayload = {
        from: fromAddress,
        to: [to.trim()],
        reply_to: replyToAddress,
        subject: subject || "Powiadomienie CRIBRO ENGLISH",
        html: html || "<p>To jest testowa wiadomo\u015B\u0107 wys\u0142ana z panelu CRIBRO ENGLISH.</p>",
        text: text || "To jest testowa wiadomo\u015B\u0107 wys\u0142ana z panelu CRIBRO ENGLISH."
      };
      if (bccToUse && bccToUse.length > 0) {
        resendPayload.bcc = bccToUse;
      }
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(resendPayload)
      });
      const raw = await response.text();
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {
      }
      if (!response.ok) {
        let msg = data?.message || data?.error || raw.slice(0, 300);
        if (typeof msg === "string" && (msg.toLowerCase().includes("domain") || msg.toLowerCase().includes("not verified") || msg.toLowerCase().includes("validation") || response.status === 403)) {
          msg += " [Wskaz\xF3wka: Aby wysy\u0142a\u0107 z adresu @maciej.pro lub @learnwithmaciej.com, dodaj domen\u0119 w https://resend.com/domains i zweryfikuj rekordy DNS w Hostingerze].";
        }
        return res.status(response.status).json({ error: `Resend ${response.status}: ${msg}` });
      }
      return res.json({ ok: true, id: data?.id, bcc: bccToUse });
    } catch (err) {
      console.error("[Mailing Test Send Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/mailing/inbound-webhook", async (req, res) => {
    try {
      const payload = req.body?.data || req.body || {};
      const rawFrom = String(payload.from || payload.sender || "");
      const to = Array.isArray(payload.to) ? payload.to.join(", ") : String(payload.to || "");
      const subject = String(payload.subject || "(Bez tematu)");
      const text = String(payload.text || payload.body || "");
      const html = String(payload.html || "");
      const emailMatch = rawFrom.match(/<([^>]+)>/) || [null, rawFrom.trim()];
      const fromEmail = (emailMatch[1] || rawFrom).trim().toLowerCase();
      const fromName = rawFrom.includes("<") ? rawFrom.split("<")[0].trim().replace(/"/g, "") : fromEmail;
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      let studentId = null;
      let studentName = null;
      if (fromEmail) {
        const snap = await adminDb.collection("users").where("email", "==", fromEmail).limit(1).get();
        if (!snap.empty) {
          const uDoc = snap.docs[0];
          const data = uDoc.data();
          studentId = uDoc.id;
          studentName = data.firstName || data.lastName ? `${data.firstName || ""} ${data.lastName || ""}`.trim() : data.username || fromName;
        }
      }
      const newMsg = {
        fromEmail,
        fromName: studentName || fromName || fromEmail,
        studentId,
        studentName,
        toEmail: to,
        subject,
        text,
        html,
        receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
        read: false,
        archived: false
      };
      const docRef = await adminDb.collection("inboundMessages").add(newMsg);
      console.log(`[Inbound Email Received]: ID ${docRef.id} from ${fromEmail}`);
      return res.json({ ok: true, id: docRef.id });
    } catch (err) {
      console.error("[Inbound Webhook Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.get("/api/mailing/inbound-messages", requireFirebaseAdmin, async (req, res) => {
    try {
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const snap = await adminDb.collection("inboundMessages").orderBy("receivedAt", "desc").limit(100).get();
      const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.json({ ok: true, messages });
    } catch (err) {
      console.error("[Get Inbound Messages Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.patch("/api/mailing/inbound-messages/:id", requireFirebaseAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const { read } = req.body;
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      await adminDb.collection("inboundMessages").doc(id).update({ read: Boolean(read) });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[Patch Inbound Message Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.delete("/api/mailing/inbound-messages/:id", requireFirebaseAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      await adminDb.collection("inboundMessages").doc(id).delete();
      return res.json({ ok: true });
    } catch (err) {
      console.error("[Delete Inbound Message Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/mailing/simulate-inbound", requireFirebaseAdmin, async (req, res) => {
    try {
      const { fromEmail, fromName, subject, text } = req.body;
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const targetEmail = (fromEmail || "kursant@example.com").trim().toLowerCase();
      let studentId = null;
      let resolvedName = fromName || "Przyk\u0142adowy Kursant";
      const snap = await adminDb.collection("users").where("email", "==", targetEmail).limit(1).get();
      if (!snap.empty) {
        const uDoc = snap.docs[0];
        const data = uDoc.data();
        studentId = uDoc.id;
        resolvedName = data.firstName || data.lastName ? `${data.firstName || ""} ${data.lastName || ""}`.trim() : data.username || resolvedName;
      }
      const newMsg = {
        fromEmail: targetEmail,
        fromName: resolvedName,
        studentId,
        studentName: resolvedName,
        toEmail: "wyrozumski@maciej.pro",
        subject: subject || "Pytanie do ostatniej pracy domowej",
        text: text || 'Cze\u015B\u0107! Mam pytanie odno\u015Bnie zadania z czasem Present Perfect. Kiedy dok\u0142adnie u\u017Cywamy "since" zamiast "for"? Pozdrawiam!',
        html: `<p>${text || 'Cze\u015B\u0107! Mam pytanie odno\u015Bnie zadania z czasem Present Perfect. Kiedy dok\u0142adnie u\u017Cywamy "since" zamiast "for"? Pozdrawiam!'}</p>`,
        receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
        read: false,
        archived: false
      };
      const docRef = await adminDb.collection("inboundMessages").add(newMsg);
      return res.json({ ok: true, id: docRef.id, message: newMsg });
    } catch (err) {
      console.error("[Simulate Inbound Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  const DEFAULT_NOTION_LESSONS_DB = "";
  const DEFAULT_NOTION_STUDENTS_DB = "";
  function normalizeNotionId(input) {
    if (!input || typeof input !== "string") return "";
    const trimmed = input.trim();
    const match = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32})/i);
    if (match) {
      const clean = match[1].replace(/-/g, "").toLowerCase();
      return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
    }
    return trimmed;
  }
  async function getNotionConfig() {
    let token = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || "";
    let meetingNotesDbId = normalizeNotionId(process.env.NOTION_LESSONS_DB || DEFAULT_NOTION_LESSONS_DB);
    let studentsDbId = normalizeNotionId(process.env.NOTION_STUDENTS_DB || DEFAULT_NOTION_STUDENTS_DB);
    let autoFetchEnabled = false;
    let autoFetchIntervalMinutes = 30;
    let lastFetchTime = null;
    let lastFetchStatus = null;
    if (adminApp) {
      try {
        const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
        const notionDoc = await adminDb.collection("system").doc("notion").get();
        if (notionDoc.exists) {
          const data = notionDoc.data() || {};
          token = typeof data.token === "string" ? data.token.trim() : token;
          meetingNotesDbId = typeof data.meetingNotesDbId === "string" ? normalizeNotionId(data.meetingNotesDbId) : meetingNotesDbId;
          studentsDbId = typeof data.studentsDbId === "string" ? normalizeNotionId(data.studentsDbId) : studentsDbId;
          if (typeof data.autoFetchEnabled === "boolean") autoFetchEnabled = data.autoFetchEnabled;
          if (typeof data.autoFetchIntervalMinutes === "number") autoFetchIntervalMinutes = data.autoFetchIntervalMinutes;
          if (data.lastFetchTime) lastFetchTime = String(data.lastFetchTime);
          if (data.lastFetchStatus) lastFetchStatus = String(data.lastFetchStatus);
        }
      } catch (e) {
        console.warn("[Notion] Nie uda\u0142o si\u0119 odczyta\u0107 konfiguracji z Firestore:", e);
      }
    }
    return {
      token,
      meetingNotesDbId,
      studentsDbId,
      autoFetchEnabled,
      autoFetchIntervalMinutes,
      lastFetchTime,
      lastFetchStatus
    };
  }
  async function fetchNotionBlocksText(token, blockId, depth = 0) {
    if (depth > 4) return "";
    const NOTION_API = "https://api.notion.com/v1";
    const NOTION_VERSION = "2022-06-28";
    const lines = [];
    let cursor;
    do {
      const url = `${NOTION_API}/blocks/${blockId}/children${cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100"}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) break;
      const data = await res.json();
      for (const block of data.results || []) {
        const type = block.type;
        if (block[type]?.rich_text) {
          const text = (block[type].rich_text || []).map((t) => t.plain_text || "").join("");
          if (text) lines.push(text);
        }
        if (block.has_children) {
          const childText = await fetchNotionBlocksText(token, block.id, depth + 1);
          if (childText) lines.push(childText);
        }
      }
      cursor = data.has_more ? data.next_cursor : void 0;
    } while (cursor);
    return lines.join("\n");
  }
  app2.get("/api/notion/config", requireFirebaseAdmin, async (_req, res) => {
    try {
      const cfg = await getNotionConfig();
      const maskedToken = cfg.token ? `${cfg.token.slice(0, 8)}\u2022\u2022\u2022\u2022${cfg.token.slice(-4)}` : null;
      return res.json({
        configured: Boolean(cfg.token),
        maskedToken,
        meetingNotesDbId: cfg.meetingNotesDbId,
        studentsDbId: cfg.studentsDbId,
        autoFetchEnabled: cfg.autoFetchEnabled,
        autoFetchIntervalMinutes: cfg.autoFetchIntervalMinutes,
        lastFetchTime: cfg.lastFetchTime,
        lastFetchStatus: cfg.lastFetchStatus
      });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/notion/save-config", requireFirebaseAdmin, async (req, res) => {
    try {
      const { token, meetingNotesDbId, studentsDbId, autoFetchEnabled, autoFetchIntervalMinutes } = req.body;
      const updates = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      if (typeof token === "string" && token.trim() !== "") {
        const cleanToken = token.trim().replace(/["']/g, "");
        updates.token = cleanToken;
        process.env.NOTION_API_KEY = cleanToken;
      }
      if (typeof meetingNotesDbId === "string") {
        const cleanMeeting = normalizeNotionId(meetingNotesDbId);
        updates.meetingNotesDbId = cleanMeeting;
        process.env.NOTION_LESSONS_DB = cleanMeeting;
      }
      if (typeof studentsDbId === "string") {
        const cleanStudents = normalizeNotionId(studentsDbId);
        updates.studentsDbId = cleanStudents;
        process.env.NOTION_STUDENTS_DB = cleanStudents;
      }
      if (typeof autoFetchEnabled === "boolean") {
        updates.autoFetchEnabled = autoFetchEnabled;
      }
      if (typeof autoFetchIntervalMinutes === "number") {
        updates.autoFetchIntervalMinutes = autoFetchIntervalMinutes;
      }
      if (adminApp) {
        try {
          const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection("system").doc("notion").set(updates, { merge: true });
        } catch (e) {
          console.warn("[Notion] Nie uda\u0142o si\u0119 zapisa\u0107 do Firestore (brak uprawnie\u0144 us\u0142ugi / fallback lokalny):", e);
        }
      }
      try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, "utf8");
          if (updates.token) {
            if (content.includes("NOTION_API_KEY=")) {
              content = content.replace(/NOTION_API_KEY=.*(\r?\n|$)/, `NOTION_API_KEY=${updates.token}
`);
            } else {
              content += `
NOTION_API_KEY=${updates.token}
`;
            }
          }
          if (updates.meetingNotesDbId) {
            if (content.includes("NOTION_LESSONS_DB=")) {
              content = content.replace(/NOTION_LESSONS_DB=.*(\r?\n|$)/, `NOTION_LESSONS_DB=${updates.meetingNotesDbId}
`);
            } else {
              content += `
NOTION_LESSONS_DB=${updates.meetingNotesDbId}
`;
            }
          }
          if (updates.studentsDbId) {
            if (content.includes("NOTION_STUDENTS_DB=")) {
              content = content.replace(/NOTION_STUDENTS_DB=.*(\r?\n|$)/, `NOTION_STUDENTS_DB=${updates.studentsDbId}
`);
            } else {
              content += `
NOTION_STUDENTS_DB=${updates.studentsDbId}
`;
            }
          }
          fs.writeFileSync(envPath, content, "utf8");
        }
      } catch (e) {
        console.warn("[Notion] Nie uda\u0142o si\u0119 zapisa\u0107 konfiguracji do .env:", e);
      }
      const cfg = await getNotionConfig();
      return res.json({
        ok: true,
        message: "Konfiguracja Notion zosta\u0142a pomy\u015Blnie zapisana.",
        maskedToken: cfg.token ? `${cfg.token.slice(0, 8)}\u2022\u2022\u2022\u2022${cfg.token.slice(-4)}` : null,
        meetingNotesDbId: cfg.meetingNotesDbId,
        studentsDbId: cfg.studentsDbId,
        autoFetchEnabled: cfg.autoFetchEnabled,
        autoFetchIntervalMinutes: cfg.autoFetchIntervalMinutes
      });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/notion/clear-config", requireFirebaseAdmin, async (_req, res) => {
    try {
      process.env.NOTION_API_KEY = "";
      process.env.NOTION_TOKEN = "";
      process.env.NOTION_LESSONS_DB = "";
      process.env.NOTION_STUDENTS_DB = "";
      if (adminApp) {
        try {
          const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection("system").doc("notion").set({
            token: "",
            meetingNotesDbId: "",
            studentsDbId: "",
            autoFetchEnabled: false,
            lastFetchTime: null,
            lastFetchStatus: null,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        } catch (e) {
          console.warn("[Notion] Nie uda\u0142o si\u0119 wyczy\u015Bci\u0107 Firestore:", e);
        }
      }
      try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, "utf8");
          content = content.replace(/NOTION_API_KEY=.*(\r?\n|$)/, `NOTION_API_KEY=
`);
          content = content.replace(/NOTION_LESSONS_DB=.*(\r?\n|$)/, `NOTION_LESSONS_DB=
`);
          content = content.replace(/NOTION_STUDENTS_DB=.*(\r?\n|$)/, `NOTION_STUDENTS_DB=
`);
          fs.writeFileSync(envPath, content, "utf8");
        }
      } catch {
      }
      return res.json({
        ok: true,
        message: "Konfiguracja Notion zosta\u0142a ca\u0142kowicie wyczyszczona, a po\u0142\u0105czenie przerwane."
      });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/notion/search-databases", requireFirebaseAdmin, async (req, res) => {
    try {
      const cfg = await getNotionConfig();
      let rawToken = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (rawToken) {
        rawToken = rawToken.replace(/["']/g, "").trim();
      }
      const token = rawToken || cfg.token;
      if (!token) {
        return res.status(400).json({
          error: 'Brak tokena Notion API. Wprowad\u017A token integracji (zaczynaj\u0105cy si\u0119 od "ntn_" lub "secret_"), aby przeszuka\u0107 udost\u0119pnione bazy.'
        });
      }
      const NOTION_API = "https://api.notion.com/v1";
      const NOTION_VERSION = "2022-06-28";
      const allDatabases = [];
      let cursor = void 0;
      let hasMore = true;
      let iterations = 0;
      while (hasMore && iterations < 3) {
        iterations++;
        const requestBody = {
          filter: {
            value: "database",
            property: "object"
          },
          page_size: 100
        };
        if (cursor) {
          requestBody.start_cursor = cursor;
        }
        const searchRes = await fetch(`${NOTION_API}/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        });
        if (!searchRes.ok) {
          const errText = await searchRes.text();
          let userMsg = `B\u0142\u0105d Notion API (${searchRes.status})`;
          if (searchRes.status === 401) {
            userMsg = "Nieprawid\u0142owy token Notion (Unauthorized). Upewnij si\u0119, \u017Ce token jest poprawny i nie zosta\u0142 uniewa\u017Cniony w panelu integracji Notion.";
          } else if (searchRes.status === 403) {
            userMsg = "Brak uprawnie\u0144 do przestrzeni roboczej Notion (Forbidden). Sprawd\u017A uprawnienia integracji.";
          } else {
            userMsg += `: ${errText.slice(0, 200)}`;
          }
          return res.status(searchRes.status).json({ error: userMsg });
        }
        const searchData = await searchRes.json();
        const rawResults = searchData.results || [];
        for (const db of rawResults) {
          const title = (db.title || []).map((t) => t.plain_text || "").join("").trim() || "Baza bez tytu\u0142u";
          const description = (db.description || []).map((d) => d.plain_text || "").join("").trim();
          const icon = db.icon?.emoji || db.icon?.external?.url || null;
          const properties = Object.keys(db.properties || {});
          allDatabases.push({
            id: db.id,
            title,
            description,
            icon,
            url: db.url || `https://notion.so/${db.id.replace(/-/g, "")}`,
            lastEditedTime: db.last_edited_time || db.created_time || null,
            properties
          });
        }
        hasMore = Boolean(searchData.has_more && searchData.next_cursor);
        cursor = searchData.next_cursor;
      }
      return res.json({
        ok: true,
        count: allDatabases.length,
        databases: allDatabases
      });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/notion/test-connection", requireFirebaseAdmin, async (req, res) => {
    try {
      const cfg = await getNotionConfig();
      let rawToken = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (rawToken) {
        rawToken = rawToken.replace(/["']/g, "").trim();
      }
      const token = rawToken || cfg.token;
      const meetingNotesDbId = normalizeNotionId(typeof req.body?.meetingNotesDbId === "string" && req.body.meetingNotesDbId.trim() || cfg.meetingNotesDbId);
      const studentsDbId = normalizeNotionId(typeof req.body?.studentsDbId === "string" && req.body.studentsDbId.trim() || cfg.studentsDbId);
      if (!token) {
        return res.status(400).json({ error: 'Brak tokena Notion API. Wprowad\u017A token integracji (np. zaczynaj\u0105cy si\u0119 od "ntn_" lub "secret_").' });
      }
      const NOTION_API = "https://api.notion.com/v1";
      const NOTION_VERSION = "2022-06-28";
      const userRes = await fetch(`${NOTION_API}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION
        }
      });
      if (!userRes.ok) {
        const errText = await userRes.text();
        return res.status(400).json({
          error: `B\u0142\u0105d uwierzytelnienia w Notion API (${userRes.status}): ${errText.slice(0, 200)}`
        });
      }
      const botData = await userRes.json();
      const botName = botData?.name || "Cribro Notion Integration";
      const workspaceName = botData?.bot?.owner?.workspace_name || "Notion Workspace";
      let meetingDbTitle = "Nie skonfigurowano";
      if (meetingNotesDbId) {
        try {
          const dbRes = await fetch(`${NOTION_API}/databases/${meetingNotesDbId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Notion-Version": NOTION_VERSION
            }
          });
          if (dbRes.ok) {
            const dbData = await dbRes.json();
            meetingDbTitle = (dbData?.title || []).map((t) => t.plain_text || "").join("") || "Baza spotka\u0144";
          } else {
            meetingDbTitle = `Uwaga: brak dost\u0119pu lub baza nieudost\u0119pniona (${dbRes.status})`;
          }
        } catch (e) {
          meetingDbTitle = `B\u0142\u0105d zapytania bazy: ${e.message}`;
        }
      }
      let studentsDbTitle = "Nie skonfigurowano";
      if (studentsDbId) {
        try {
          const sdbRes = await fetch(`${NOTION_API}/databases/${studentsDbId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Notion-Version": NOTION_VERSION
            }
          });
          if (sdbRes.ok) {
            const sdbData = await sdbRes.json();
            studentsDbTitle = (sdbData?.title || []).map((t) => t.plain_text || "").join("") || "Baza kursant\xF3w";
          } else {
            studentsDbTitle = `Uwaga: brak dost\u0119pu lub baza nieudost\u0119pniona (${sdbRes.status})`;
          }
        } catch (e) {
          studentsDbTitle = `B\u0142\u0105d zapytania bazy: ${e.message}`;
        }
      }
      return res.json({
        ok: true,
        botName,
        workspaceName,
        meetingDbTitle,
        studentsDbTitle,
        message: `Po\u0142\u0105czenie z Notion udane! Bot "${botName}" w workspace "${workspaceName}".`
      });
    } catch (err) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  async function syncNotionTranscriptsFromApi() {
    const cfg = await getNotionConfig();
    const token = cfg.token;
    const meetingNotesDbId = normalizeNotionId(cfg.meetingNotesDbId);
    if (!token || !meetingNotesDbId || !adminApp) {
      return { found: 0, processed: 0, importedCount: 0, items: [], unmatchedTranscripts: [], lastFetchTime: (/* @__PURE__ */ new Date()).toISOString() };
    }
    const NOTION_API = "https://api.notion.com/v1";
    const NOTION_VERSION = "2022-06-28";
    const adminDb = getFirestore2(adminApp, FIRESTORE_DATABASE_ID);
    const usersSnap = await adminDb.collection("users").get();
    const userList = usersSnap.docs.map((d) => {
      const u = d.data();
      const fullName = u.firstName || u.lastName ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : u.username || "";
      return {
        id: d.id,
        name: fullName,
        email: u.email || "",
        isGroup: Boolean(u.isGroup || u.role === "group"),
        memberIds: u.memberIds || [],
        level: u.level || ""
      };
    });
    const queryRes = await fetch(`${NOTION_API}/databases/${meetingNotesDbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ page_size: 40 })
    });
    if (!queryRes.ok) {
      const errTxt = await queryRes.text();
      throw new Error(`B\u0142\u0105d zapytania bazy Notion (${queryRes.status}): ${errTxt.slice(0, 300)}`);
    }
    const queryData = await queryRes.json();
    const pages = queryData.results || [];
    const processedItems = [];
    const unmatchedTranscripts = [];
    for (const page of pages) {
      const props = page.properties || {};
      let title = "";
      for (const key of Object.keys(props)) {
        if (props[key].type === "title") {
          title = (props[key].title || []).map((t) => t.plain_text || "").join("").trim();
          break;
        }
      }
      if (!title) title = "Spotkanie bez tytu\u0142u";
      let dateStr = "";
      for (const key of Object.keys(props)) {
        if (props[key].type === "date" && props[key].date?.start) {
          dateStr = props[key].date.start.split("T")[0];
          break;
        }
      }
      if (!dateStr) dateStr = (page.created_time || (/* @__PURE__ */ new Date()).toISOString()).split("T")[0];
      const existingSnap = await adminDb.collection("lessonRecords").where("notionPageId", "==", page.id).limit(1).get();
      if (!existingSnap.empty) {
        processedItems.push({
          id: page.id,
          title,
          studentName: existingSnap.docs[0].data().studentName || "Ju\u017C zaimportowano",
          date: dateStr,
          status: "istnieje"
        });
        continue;
      }
      const transcriptText = await fetchNotionBlocksText(token, page.id, 0);
      if (!transcriptText || transcriptText.length < 50) {
        processedItems.push({
          id: page.id,
          title,
          studentName: "Brak transkrypcji",
          date: dateStr,
          status: "pomini\u0119to (pusta tre\u015B\u0107)"
        });
        continue;
      }
      let matchedUser = null;
      const normTitle = title.toLowerCase();
      const normTranscript = transcriptText.slice(0, 2500).toLowerCase();
      for (const u of userList) {
        if (u.isGroup && u.name) {
          if (normTitle.includes(u.name.toLowerCase()) || normTranscript.includes(u.name.toLowerCase())) {
            matchedUser = u;
            break;
          }
        }
      }
      if (!matchedUser) {
        for (const u of userList) {
          if (u.email && (normTitle.includes(u.email.toLowerCase()) || normTranscript.includes(u.email.toLowerCase()))) {
            matchedUser = u;
            break;
          }
        }
      }
      if (!matchedUser) {
        for (const u of userList) {
          if (u.name && u.name.length > 4) {
            const parts = u.name.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
            if (parts.length >= 2 && (normTitle.includes(parts.join(" ")) || normTranscript.includes(parts.join(" ")))) {
              matchedUser = u;
              break;
            }
          }
        }
      }
      if (!matchedUser) {
        for (const u of userList) {
          if (u.name) {
            const firstName = u.name.toLowerCase().split(/\s+/)[0];
            if (firstName && firstName.length >= 3 && normTitle.includes(firstName)) {
              matchedUser = u;
              break;
            }
          }
        }
      }
      if (!matchedUser) {
        unmatchedTranscripts.push({
          id: page.id,
          title,
          date: dateStr,
          snippet: transcriptText.slice(0, 200).replace(/\s+/g, " ").trim(),
          reason: "Nie dopasowano do \u017Cadnego kursanta ani grupy w bazie (spotkanie poza zaj\u0119ciami)"
        });
        processedItems.push({
          id: page.id,
          title,
          studentName: "Brak dopasowania (zignorowano)",
          date: dateStr,
          status: "zignorowano (brak powi\u0105zania z kursantem)"
        });
        continue;
      }
      const studentId = matchedUser.id;
      const studentName = matchedUser.name || title.split(/[\-\–—:]/)[0].trim() || "Kursant";
      const newLessonRef = adminDb.collection("lessonRecords").doc();
      const lessonPayload = {
        studentId,
        studentIds: matchedUser.isGroup && matchedUser.memberIds?.length ? matchedUser.memberIds : [studentId],
        studentName,
        date: dateStr,
        topic: title,
        rawTranscript: transcriptText,
        liveTranscript: transcriptText,
        notionPageId: page.id,
        source: "notion",
        isGroupLesson: Boolean(matchedUser.isGroup),
        sessionStatus: "draft",
        status: "pending",
        isPendingConfirmation: true,
        pendingReason: "Zaimportowano now\u0105 transkrypcj\u0119 z Notion",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await newLessonRef.set(lessonPayload);
      try {
        await adminDb.collection("users").doc(studentId).collection("lessonRecords").doc(newLessonRef.id).set(lessonPayload, { merge: true });
      } catch (subErr) {
        console.warn(`[Notion Sync] Nie uda\u0142o si\u0119 zapisa\u0107 do users/${studentId}/lessonRecords:`, subErr);
      }
      processedItems.push({
        id: page.id,
        title,
        studentName,
        date: dateStr,
        status: "zaimportowano"
      });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    await adminDb.collection("system").doc("notion").set({
      lastFetchTime: nowIso,
      lastFetchStatus: `Przetworzono ${processedItems.length} stron z Notion (${unmatchedTranscripts.length} zignorowano)`
    }, { merge: true });
    return {
      found: pages.length,
      processed: processedItems.length,
      importedCount: processedItems.filter((p) => p.status === "zaimportowano").length,
      items: processedItems,
      unmatchedTranscripts,
      lastFetchTime: nowIso
    };
  }
  app2.post("/api/notion/fetch-transcripts", requireFirebaseAdmin, async (req, res) => {
    try {
      const result = await syncNotionTranscriptsFromApi();
      return res.json({
        ok: true,
        ...result
      });
    } catch (err) {
      console.error("[Notion Fetch Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.get("/api/notion/recent-meetings", requireFirebaseAdmin, async (_req, res) => {
    try {
      const cfg = await getNotionConfig();
      const token = cfg.token;
      const meetingNotesDbId = normalizeNotionId(cfg.meetingNotesDbId);
      if (!token || !meetingNotesDbId) {
        return res.json({
          ok: true,
          configured: false,
          meetings: [],
          message: "Baza spotka\u0144 Notion nie jest jeszcze skonfigurowana."
        });
      }
      const NOTION_API = "https://api.notion.com/v1";
      const NOTION_VERSION = "2022-06-28";
      const sevenDaysAgo = /* @__PURE__ */ new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();
      const queryRes = await fetch(`${NOTION_API}/databases/${meetingNotesDbId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          page_size: 50,
          sorts: [
            {
              timestamp: "created_time",
              direction: "descending"
            }
          ]
        })
      });
      if (!queryRes.ok) {
        const errTxt = await queryRes.text();
        return res.status(queryRes.status).json({
          error: `B\u0142\u0105d odpytywania bazy Notion (${queryRes.status}): ${errTxt.slice(0, 250)}`
        });
      }
      const queryData = await queryRes.json();
      const pages = queryData.results || [];
      const meetings = [];
      for (const page of pages) {
        const props = page.properties || {};
        let title = "";
        for (const key of Object.keys(props)) {
          if (props[key].type === "title") {
            title = (props[key].title || []).map((t) => t.plain_text || "").join("").trim();
            break;
          }
        }
        if (!title) title = "Spotkanie bez tytu\u0142u";
        let studentNameRaw = "";
        for (const key of Object.keys(props)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("kursant") || lowerKey.includes("student") || lowerKey.includes("ucze\u0144") || lowerKey.includes("klient")) {
            const prop = props[key];
            if (prop.type === "rich_text") {
              studentNameRaw = (prop.rich_text || []).map((t) => t.plain_text || "").join("").trim();
            } else if (prop.type === "title") {
              studentNameRaw = (prop.title || []).map((t) => t.plain_text || "").join("").trim();
            } else if (prop.type === "select" && prop.select?.name) {
              studentNameRaw = prop.select.name.trim();
            } else if (prop.type === "people" && prop.people?.length > 0) {
              studentNameRaw = prop.people.map((p) => p.name || p.person?.email || "").filter(Boolean).join(", ");
            } else if (prop.type === "relation" && prop.relation?.length > 0) {
              studentNameRaw = "Relacja do kursanta";
            }
            if (studentNameRaw) break;
          }
        }
        if (!studentNameRaw && title) {
          const cleanFromTitle = title.split(/[@–—\-:(]/)[0].trim();
          if (cleanFromTitle && cleanFromTitle.length >= 3) {
            studentNameRaw = cleanFromTitle;
          }
        }
        let lessonDate = "";
        for (const key of Object.keys(props)) {
          const lowerKey = key.toLowerCase();
          if (props[key].type === "date" && props[key].date?.start) {
            lessonDate = props[key].date.start.split("T")[0];
            if (lowerKey.includes("zaj\u0119\u0107") || lowerKey.includes("lekcj") || lowerKey.includes("data")) {
              break;
            }
          }
        }
        if (!lessonDate) {
          lessonDate = (page.created_time || (/* @__PURE__ */ new Date()).toISOString()).split("T")[0];
        }
        const pageDateObj = new Date(lessonDate || page.created_time);
        const isRecent = isNaN(pageDateObj.getTime()) || Date.now() - pageDateObj.getTime() <= 10 * 24 * 60 * 60 * 1e3;
        if (isRecent || meetings.length < 15) {
          meetings.push({
            id: page.id,
            title,
            studentNameRaw,
            lessonDate,
            url: page.url || `https://notion.so/${page.id.replace(/-/g, "")}`,
            createdTime: page.created_time
          });
        }
      }
      return res.json({
        ok: true,
        configured: true,
        meetings
      });
    } catch (err) {
      console.error("[Notion Recent Meetings Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.get("/api/notion/meeting-content/:pageId", requireFirebaseAdmin, async (req, res) => {
    try {
      const pageId = String(req.params.pageId || "").trim();
      if (!pageId) {
        return res.status(400).json({ error: "Brak identyfikatora strony Notion (pageId)." });
      }
      const cfg = await getNotionConfig();
      const token = cfg.token;
      if (!token) {
        return res.status(400).json({ error: "Brak skonfigurowanego tokena Notion API." });
      }
      const content = await fetchNotionBlocksText(token, pageId, 0);
      return res.json({
        ok: true,
        pageId,
        content: content || "",
        length: content ? content.length : 0
      });
    } catch (err) {
      console.error("[Notion Meeting Content Error]:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });
  setInterval(async () => {
    try {
      const cfg = await getNotionConfig();
      if (!cfg.autoFetchEnabled || !cfg.token) return;
      const lastFetch = cfg.lastFetchTime ? new Date(cfg.lastFetchTime).getTime() : 0;
      const intervalMs = (cfg.autoFetchIntervalMinutes || 30) * 60 * 1e3;
      if (Date.now() - lastFetch >= intervalMs) {
        console.log("[Notion Auto-Fetch] Uruchamiam cykliczn\u0105 synchronizacj\u0119 transkrypcji...");
        await syncNotionTranscriptsFromApi();
      }
    } catch (e) {
      console.warn("[Notion Auto-Fetch Error]:", e);
    }
  }, 5 * 60 * 1e3);
  app2.post("/api/gemini/generate-test", requireFirebaseAdmin, async (req, res) => {
    try {
      const { level, testTitle, scope, studentProfile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, typeCounts, fileData, driveFile } = req.body;
      const apiKey = getGeminiApiKey();
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      let typeBreakdownInstruction = "";
      if (typeCounts && typeof typeCounts === "object" && Object.keys(typeCounts).length > 0) {
        const parts = Object.entries(typeCounts).filter(([t]) => !selectedTypes || selectedTypes.includes(t)).map(([type, count]) => `- ${type}: DOK\u0141ADNIE 1 ZADANIE ZBIORCZE zawieraj\u0105ce ${count} przyk\u0142ad\xF3w/zda\u0144 w bullet pointach`);
        if (parts.length > 0) {
          typeBreakdownInstruction = `STRUKTURA ZADA\u0143 W TESTU (G\u0141\xD3WNA ZASADA GRUPOWANIA):
${parts.join("\n")}
Ka\u017Cdy z wybranych typ\xF3w ma stanowi\u0107 DOK\u0141ADNIE JEDNO POJEDYNCZE ZADANIE ZBIORCZE z wybran\u0105 liczb\u0105 przyk\u0142ad\xF3w! \u0141\u0105czna liczba obiekt\xF3w w tablicy pyta\u0144 ma wynosi\u0107 DOK\u0141ADNIE ${selectedTypes ? selectedTypes.length : 1} (po jednym obiekcie dla ka\u017Cdego wybranego typu).`;
        }
      }
      const activeTypes = selectedTypes || ["multiple_choice", "fill_in_blank", "fill_in_blank_bank", "translation"];
      const activeRules = rulesForTypes(activeTypes);
      let contents = [];
      const prompt = `Jeste\u015B asystentem edukacyjnym, generatorem test\xF3w opartym o zaawansowany model.
Twoim zadaniem jest przygotowanie wysoce spersonalizowanego testu dla kursanta, analizuj\u0105c jego histori\u0119 lekcji.

${LANGUAGE_IRON_RULE}

# KLUCZOWA ZASADA STRUKTURALNA (POJEDYNCZE ZADANIE ZBIORCZE DLA KA\u017BDEGO TYPU \u0106WICZENIA):
Dla ka\u017Cdego wybranego typu zadania (np. 'translation', 'fill_in_blank', 'matching' itp.) tw\xF3rz **TYLKO JEDNO DANE ZADANIE ZBIORCZE** (jeden obiekt w tablicy JSON).
Wszystkie podane przyk\u0142ady/zdania dla danego typu umie\u015B\u0107 WEWN\u0104TRZ tego jednego zadania (np. w polu 'prompt' jako wypunktowana/numerowana lista w bullet pointach 1., 2., 3., 4... lub w 'options' w przypadku \u0142\u0105czenia w pary).
Nie tw\xF3rz osobnych obiekt\xF3w zada\u0144 dla ka\u017Cdego zdania!

Przyk\u0142ad: Je\u015Bli nauczyciel wybra\u0142 'translation' i liczb\u0119 przyk\u0142ad\xF3w 4:
Tworzysz 1 obiekt typu 'translation':
- instruction: "Przet\u0142umacz poni\u017Csze zdania na j\u0119zyk angielski:"
- prompt: "1. Pierwsze zdanie po polsku.
2. Drugie zdanie po polsku.
3. Trzecie zdanie po polsku.
4. Czwarte zdanie po polsku."
- correctAnswer: "1. First sentence.
2. Second sentence.
3. Third sentence.
4. Fourth sentence."

# ZASADY \u017BELAZNE:
1. Przeanalizuj dok\u0142adnie profil kursanta:
${studentProfile}
Oraz CA\u0141\u0104 histori\u0119 jego lekcji:
${allLessonsContext}

2. Test musi by\u0107 \u015Bci\u015Ble dostosowany do poziomu kursanta: ${level}.
3. Oprzyj merytoryk\u0119 zada\u0144 G\u0141\xD3WNIE na wybranych lekcjach stanowi\u0105cych kontekst bie\u017C\u0105cego materia\u0142u:
${lessonContext}
4. Wygeneruj DOK\u0141ADNIE ${selectedTypes ? selectedTypes.length : 1} obiekt\xF3w zada\u0144 w tablicy wynikowej (po 1 zbiorczym zadaniu na ka\u017Cdy typ):
${typeBreakdownInstruction}

5. U\u017Cyj TYLKO nast\u0119puj\u0105cych typ\xF3w zada\u0144 wybranych przez nauczyciela: ${selectedTypes ? selectedTypes.join(", ") : "multiple_choice, fill_in_blank, fill_in_blank_bank, translation"}.
   ZABRANIA SI\u0118 TWORZENIA ZADA\u0143 INNEGO TYPU. Je\u015Bli dany typ nie zosta\u0142 wymieniony na li\u015Bcie powy\u017Cej, NIE MO\u017BE pojawi\u0107 si\u0119 w te\u015Bcie!
   Zasady dla typ\xF3w zada\u0144 zbiorczych:
   ${activeRules}
   
   J\u0118ZYK I STYL ZDA\u0143:
   Wszystkie wygenerowane zdania, teksty i historyjki musz\u0105 by\u0107 w 100% naturalne i oparte na autentycznych materia\u0142ach, przerobionych z kursantem.
   Unikaj "pokr\u0119conych", sztucznych i fikcyjnych konstrukcji. Pisz tak, jak rozmawiaj\u0105 ludzie. Zastosuj si\u0119 \u015Bci\u015Ble do przes\u0142anego kontekstu lekcji.

   SP\xD3JNO\u015A\u0106 LOGICZNO-SEMANTYCZNA \u2014 ZASADY ROZSTRZYGAJ\u0104CE:
   a) SENS PRZED S\u0141OWNICTWEM. Ka\u017Cde zdanie ma opisywa\u0107 sytuacj\u0119, kt\xF3ra mog\u0142a si\u0119 wydarzy\u0107: podmiot musi
      m\xF3c wykona\u0107 czynno\u015B\u0107, dope\u0142nienie musi do niej pasowa\u0107. Zdanie poprawne gramatycznie, ale bezsensowne
      znaczeniowo, jest b\u0142\u0119dem r\xF3wnie ci\u0119\u017Ckim jak b\u0142\u0105d gramatyczny. U\u017Cycie s\u0142owa z materia\u0142u NIGDY nie
      usprawiedliwia zdania, kt\xF3re nie ma sensu.
   b) JEDNA POPRAWNA ODPOWIED\u0179. Ka\u017Cde zadanie musi mie\u0107 dok\u0142adnie jedno rozwi\u0105zanie. Je\u015Bli w luk\u0119 albo w
      t\u0142umaczenie pasuje kilka r\xF3wnie dobrych wariant\xF3w, dopisz kontekst zaw\u0119\u017Caj\u0105cy albo przebuduj zadanie \u2014
      inaczej kursant dostanie b\u0142\u0105d za poprawn\u0105 odpowied\u017A. Dotyczy to zw\u0142aszcza synonim\xF3w i zamiennych
      konstrukcji ("I must" / "I have to").
   c) KONTEKST WYSTARCZAJ\u0104CY DO ROZWI\u0104ZANIA. Zadanie ma by\u0107 rozwi\u0105zywalne z samej swojej tre\u015Bci, bez
      zgadywania, co autor mia\u0142 na my\u015Bli. Zdanie z luk\u0105 musi nie\u015B\u0107 wskaz\xF3wk\u0119, kt\xF3ra przes\u0105dza o odpowiedzi.
   d) SP\xD3JNO\u015A\u0106 WEWN\u0104TRZ ZADANIA ZBIORCZEGO. Wszystkie punkty (1., 2., 3.) w jednym zadaniu maj\u0105 trzyma\u0107 si\u0119
      jednego tematu i jednego rejestru \u2014 razem maj\u0105 czyta\u0107 si\u0119 jak zestaw z jednej lekcji, a nie jak zdania
      zebrane z r\xF3\u017Cnych podr\u0119cznik\xF3w.
   e) DYSTRAKTORY MUSZ\u0104 BY\u0106 WIARYGODNE. B\u0142\u0119dne opcje to typowe pomy\u0142ki Polaka: kalka z polskiego, mylony czas,
      z\u0142y przyimek, cz\u0119sty b\u0142\u0105d ortograficzny. Opcje absurdalne albo z\u0142o\u017Cone z przypadkowych s\u0142\xF3w niczego nie
      sprawdzaj\u0105 i s\u0105 zabronione.
   f) POLSZCZYZNA MA BRZMIE\u0106 PO POLSKU. Zdania do t\u0142umaczenia i polecenia to zdania, jakie napisa\u0142by Polak,
      a nie t\u0142umaczenie s\u0142owo w s\u0142owo z angielskiego.
   
6. WA\u017BNE - FORMATOWANIE I BRAK DUBLOWANIA:
   W polu "instruction" zamie\u015B\u0107 Kr\xF3tkie Og\xF3lne Polecenie w j\u0119zyku polskim (np. "Przet\u0142umacz poni\u017Csze zdania na j\u0119zyk angielski:").
   W polu "prompt" umie\u015B\u0107 w\u0142a\u015Bciwe przyk\u0142ady w punktach 1., 2., 3...
   BEZWZGL\u0118DNIE KA\u017BDY PUNKT (1., 2., 3...) W POLU "prompt" ORAZ "correctAnswer" MUSI ZACZYNA\u0106 SI\u0118 OD NOWEJ LINII (
)! ZABRANIA SI\u0118 UMIESZCZANIA KILKU ZDA\u0143 W TEJ SAMEJ LINII.
   BEZWZGL\u0118DNIE ZABRANIA SI\u0118 POWTARZANIA TRE\u015ACI POLECENIA W POLU PROMPT!

Tytu\u0142 testu: ${testTitle}
Zakres materia\u0142u: ${scope}
  
Zwr\xF3\u0107 wynik jako obiekt JSON zawieraj\u0105cy tablic\u0119 obiekt\xF3w pyta\u0144.`;
      if (driveFile) {
        const url = driveFile.mimeType === "application/pdf" ? `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media` : `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=text/plain`;
        const fetchRes = await fetch(url, { headers: { Authorization: `Bearer ${driveFile.token}` } });
        if (!fetchRes.ok) throw new Error("Failed to fetch from Google Drive: " + await fetchRes.text());
        if (driveFile.mimeType === "application/pdf") {
          const arrayBuffer = await fetchRes.arrayBuffer();
          contents = [
            { text: prompt },
            { inlineData: { mimeType: "application/pdf", data: Buffer.from(arrayBuffer).toString("base64") } }
          ];
        } else {
          const textContent = await fetchRes.text();
          contents = [
            { text: prompt + "\n\n[MATERIA\u0141 DODATKOWY Z GOOGLE DRIVE]:\n" + textContent }
          ];
        }
      } else if (fileData) {
        contents = [
          { text: prompt },
          { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }
        ];
      } else {
        contents = [{ text: prompt }];
      }
      const schema = {
        type: Type.ARRAY,
        description: "Array of test questions",
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["multiple_choice", "fill_in_blank", "fill_in_blank_bank", "translation", "matching", "writing", "find_mistake"], description: "Type of the question" },
            instruction: { type: Type.STRING, description: 'Short instruction in Polish, e.g. "Uzupe\u0142nij luki:"' },
            prompt: { type: Type.STRING, description: "The question or the sentence to translate/fill" },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Options for multiple_choice, find_mistake or matching pairs."
            },
            wordBank: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of words in the word bank for fill_in_blank_bank"
            },
            correctAnswer: { type: Type.STRING, description: "The correct answer (exact string)." },
            hint: { type: Type.STRING, description: "Optional hint in Polish." }
          },
          required: ["type", "instruction", "prompt", "correctAnswer"]
        }
      };
      const draftResponse = await generateContentWithRetry(ai, contents, {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.4
      });
      const parseQuestions = extractListFromModelJson;
      const draftQuestions = parseQuestions(draftResponse.text);
      if (!draftQuestions) {
        console.error("Generowanie testu: pierwszy przebieg nie zwr\xF3ci\u0142 poprawnego JSON-a", {
          snippet: (draftResponse.text || "").slice(0, 500)
        });
        return res.status(502).json({
          error: "Model nie zwr\xF3ci\u0142 poprawnej listy zada\u0144. Spr\xF3buj ponownie lub zmniejsz liczb\u0119 zada\u0144."
        });
      }
      const verificationPrompt = `Przeanalizuj poni\u017Csze wygenerowane zadania testowe w formacie JSON:
${draftResponse.text}

TWOJE ZADANIE: Sprawd\u017A sp\xF3jno\u015B\u0107 logiczn\u0105 i sens wygenerowanych pyta\u0144. Upewnij si\u0119, \u017Ce zadania i odpowiedzi s\u0105 naturalne, poprawne merytorycznie i nie zawieraj\u0105 sztucznego, robotycznego j\u0119zyka.
Je\u015Bli to konieczne, popraw tre\u015B\u0107, aby by\u0142a w 100% poprawna i praktyczna z punktu widzenia nauczania j\u0119zyka angielskiego.
Zwr\xF3\u0107 skorygowany wynik WY\u0141\u0104CZNIE jako poprawn\u0105 tablic\u0119 JSON, zachowuj\u0105c dok\u0142adnie t\u0119 sam\u0105 struktur\u0119.`;
      let parsed = draftQuestions;
      try {
        const verified = await generateContentWithRetry(ai, [{ text: verificationPrompt }], {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.3
        });
        const verifiedQuestions = parseQuestions(verified.text);
        if (verifiedQuestions) {
          parsed = verifiedQuestions;
        } else {
          console.warn("Generowanie testu: weryfikacja nie zwr\xF3ci\u0142a poprawnej listy \u2014 zostaje pierwszy przebieg");
        }
      } catch (verificationError) {
        console.warn("Generowanie testu: weryfikacja nie powiod\u0142a si\u0119 \u2014 zostaje pierwszy przebieg", {
          error: verificationError?.message || String(verificationError)
        });
      }
      const languageProblems = validateTestLanguage(parsed);
      if (languageProblems.length > 0) {
        console.warn("Generowanie testu: z\u0142a wersja j\u0119zykowa zada\u0144 \u2014 pr\xF3buj\u0119 naprawi\u0107", {
          problems: languageProblems.map((p) => `${p.type}.${p.field}: ${p.found}`)
        });
        const repairPrompt = `${LANGUAGE_IRON_RULE}

Poni\u017Cszy test zosta\u0142 wygenerowany z b\u0142\u0119dami j\u0119zykowymi:

${JSON.stringify(parsed)}

ZARZUTY:
${describeProblems(languageProblems)}

Popraw WY\u0141\u0104CZNIE j\u0119zyk wskazanych p\xF3l. Zachowaj typy zada\u0144, liczb\u0119 zada\u0144, struktur\u0119
i tematyk\u0119. Tekst, kt\xF3ry ma by\u0107 po angielsku, przet\u0142umacz lub napisz od nowa po angielsku
tak, \u017Ceby \u0107wiczenie dalej sprawdza\u0142o to samo. Zwr\xF3\u0107 wynik w tej samej strukturze JSON.`;
        try {
          const repaired = await generateContentWithRetry(ai, [{ text: repairPrompt }], {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.2
          });
          const repairedQuestions = parseQuestions(repaired.text);
          if (repairedQuestions && validateTestLanguage(repairedQuestions).length === 0) {
            parsed = repairedQuestions;
            console.log("Generowanie testu: naprawa j\u0119zykowa powiod\u0142a si\u0119");
          } else {
            return res.status(502).json({
              error: "Model wygenerowa\u0142 \u0107wiczenia w z\u0142ym j\u0119zyku (tre\u015B\u0107 po polsku zamiast po angielsku) i nie poprawi\u0142 ich po podpowiedzi. Spr\xF3buj ponownie albo zmniejsz liczb\u0119 typ\xF3w zada\u0144."
            });
          }
        } catch (repairError) {
          console.error("Generowanie testu: naprawa j\u0119zykowa nie powiod\u0142a si\u0119", {
            error: repairError?.message || String(repairError)
          });
          return res.status(502).json({
            error: "Nie uda\u0142o si\u0119 wygenerowa\u0107 \u0107wicze\u0144 po angielsku. Spr\xF3buj ponownie."
          });
        }
      }
      if (Array.isArray(parsed)) {
        parsed = parsed.map(
          (question) => Array.isArray(question?.wordBank) && question.wordBank.length > 1 ? { ...question, wordBank: shuffleDistinct(question.wordBank) } : question
        );
      }
      return res.json({ questions: parsed });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.post("/api/gemini/import-lessons-batch", requireFirebaseAdmin, async (req, res) => {
    try {
      const { textContent, pdfBase64, driveFile, students, targetStudentId, targetStudentName } = req.body;
      if (!textContent && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: "Missing textContent, pdfBase64 or driveFile" });
      }
      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) {
        return res.status(500).json({ error: "AI API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in environment variables." });
      }
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      const studentsListStr = typeof students === "string" ? students : Array.isArray(students) ? students.map((s) => `ID: ${s.id} | Imi\u0119/Nazwisko: ${s.name || s.username || ""} | Poziom: ${s.level || ""} | Opis: ${s.description || ""}`).join("\n") : "Brak bazy kursant\xF3w";
      let parsedDocText = textContent || "";
      let isPdfFallbackNeeded = false;
      if (pdfBase64) {
        try {
          const rawB64 = pdfBase64.split(",")[1] || pdfBase64;
          const pdfBuffer = Buffer.from(rawB64, "base64");
          const pdfData = await pdfParse(pdfBuffer);
          if (pdfData && pdfData.text && pdfData.text.trim().length > 10) {
            parsedDocText = (parsedDocText ? parsedDocText + "\n\n" : "") + pdfData.text;
          } else {
            isPdfFallbackNeeded = true;
          }
        } catch (pdfErr) {
          console.warn("pdf-parse failed, falling back to multi-modal PDF upload:", pdfErr);
          isPdfFallbackNeeded = true;
        }
      }
      if (driveFile) {
        try {
          const url = driveFile.mimeType === "application/pdf" ? `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media` : `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=text/plain`;
          const driveRes = await fetch(url, { headers: { Authorization: `Bearer ${driveFile.token}` } });
          if (!driveRes.ok) throw new Error("Failed to fetch from Google Drive: " + await driveRes.text());
          if (driveFile.mimeType === "application/pdf") {
            const arrayBuffer = await driveRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            try {
              const drivePdfData = await pdfParse(buffer);
              if (drivePdfData && drivePdfData.text) {
                parsedDocText = (parsedDocText ? parsedDocText + "\n\n" : "") + drivePdfData.text;
              } else {
                isPdfFallbackNeeded = true;
              }
            } catch (e) {
              isPdfFallbackNeeded = true;
            }
          } else {
            const driveText = await driveRes.text();
            parsedDocText = (parsedDocText ? parsedDocText + "\n\n" : "") + driveText;
          }
        } catch (dErr) {
          console.warn("Drive file processing error:", dErr);
        }
      }
      let contents = [];
      if (isPdfFallbackNeeded && pdfBase64) {
        contents = [{
          role: "user",
          parts: [
            {
              inlineData: {
                data: pdfBase64.split(",")[1] || pdfBase64,
                mimeType: "application/pdf"
              }
            },
            { text: `Baza kursant\xF3w:
${studentsListStr}

Przeanalizuj powyzszy plik PDF z histori\u0105 lekcji.` }
          ]
        }];
      } else {
        const MAX_SOURCE_CHARS = 12e4;
        if (parsedDocText.length > MAX_SOURCE_CHARS) {
          console.warn(
            `[import-lessons-batch] Materia\u0142 ma ${parsedDocText.length} znak\xF3w \u2014 ucinam do ${MAX_SOURCE_CHARS}.`
          );
          parsedDocText = parsedDocText.slice(0, MAX_SOURCE_CHARS);
        }
        contents = [{
          role: "user",
          parts: [
            { text: `Baza kursant\xF3w:
${studentsListStr}

Tre\u015B\u0107 dokumentu/notatek z histori\u0105 lekcji:
${parsedDocText}` }
          ]
        }];
      }
      const sysInstruction = `# Cel
Jeste\u015B precyzyjnym asystentem nauczyciela j\u0119zyka angielskiego. Twoim zadaniem jest przeanalizowanie tekstu/dokumentu zawieraj\u0105cego histori\u0119 lekcji jednego lub wielu kursant\xF3w i wyodr\u0119bnienie WY\u0141\u0104CZNIE DOK\u0141ADNYCH lekcji w strukturze JSON.

# BARDZO WA\u017BNE ZASADY ANALIZY I PRZYPISYWANIA:

1. AKTYWNY KURSANT (ZAK\u0141ADKA / PROFIL):
${targetStudentId ? `G\u0142\xF3wnym kursantem jest: ${targetStudentName || targetStudentId} (ID: "${targetStudentId}"). Je\u015Bli plik zawiera histori\u0119 lekcji tego kursanta lub nie precyzuje innego konkretnego nazwiska z bazy, KA\u017BDEJ wyodr\u0119bnionej lekcji przypisz ten studentId: "${targetStudentId}".` : "Dopasuj kursanta na podstawie nazwiska/imienia z dokumentu i podanej bazy."}

2. NAG\u0141\xD3WKI DAT (date):
- PRZEANALIZUJ nag\u0142\xF3wki i daty przy ka\u017Cdej lekcji w pliku (np. "12.03.2024", "12 marca 2024", "2024-03-12", "Lekcja z dnia 15/01/2024", "10.05.2023").
- Przekonwertuj ka\u017Cd\u0105 dat\u0119 do standardowego formatu YYYY-MM-DD (np. "2024-03-12").
- BEZWZGL\u0118DNIE ZACHOWAJ oryginaln\u0105 dat\u0119 ka\u017Cdej lekcji z pliku! ZABRONIONE jest zast\u0119powanie istniej\u0105cej w pliku daty dzisiejsz\u0105 dat\u0105. Tylko w przypadku ca\u0142kowitego braku jakiejkolwiek daty w sekcji danej lekcji podaj dzisiejsz\u0105 dat\u0119.

3. NAZWY TEMAT\xD3W LEKCJI (lessonTopic):
- BEZWZGL\u0118DNA ZASADA: Je\u015Bli w pliku/dokumentach znajduje si\u0119 nazwa lub temat lekcji (np. "Temat: Rozmowa kwalifikacyjna", "Topic: Present Perfect vs Past Simple", "Grammar: First Conditional", "Business English: Negotiations"), U\u017BYJ DOK\u0141ADNIE TEJ NAZWY TEMATU Z PLIKU!
- NIE WYMY\u015ALAJ nowych nazw temat\xF3w, NIE PARAFRAZUJ ani NIE MODYFIKUJ nazwy tematu, je\u015Bli jest ona podana w pliku!
- Tw\xF3rz/generuj nazw\u0119 tematu TYLKO WTEDY, gdy w sekcji lekcji w pliku absolutnie NIE podano \u017Cadnego tematu ani tytu\u0142u.

4. POZOSTA\u0141E POLA KA\u017BDEJ LEKCJI:
- studentId (string): ID wybranego dopasowanego kursanta.
- studentIds (array of strings): Lista ID wszystkich dopasowanych kursant\xF3w dla danej lekcji.
- revisionNotes (string): Om\xF3wione zagadnienia, teoria, notatki z lekcji.
- vocabularyText (string): Wyodr\u0119bnij WSZYSTKIE s\u0142\xF3wka, zwroty i idiomy, kt\xF3re pojawiaj\u0105 si\u0119 w sekcji lekcji. Nawet je\u015Bli s\u0105 zapisane ci\u0105giem (nie w kolumnie), wy\u0142uskaj DOK\u0141ADNIE KA\u017BDE z nich. U\u0142\xF3\u017C je w formacie: "s\u0142owo_angielskie - polskie_t\u0142umaczenie" (ka\u017Cde s\u0142\xF3wko w osobnej linii). Uwa\u017Caj, aby nie pomin\u0105\u0107 \u017Cadnego s\u0142owa z notatek.
- studentSpeaking (string): Uwagi dotycz\u0105ce wypowiedzi kursanta, jego opinie, tematy na kt\xF3re si\u0119 wypowiada\u0142.
- thingsToImprove (string): Wskaz\xF3wki, b\u0142\u0119dy gramatyczne, wymowa i rzeczy do poprawy.
- suggestedFollowUp (string): Praca domowa, \u0107wiczenia i zalecenia na przysz\u0142o\u015B\u0107.

Przeanalizuj CA\u0141\u0104 tre\u015B\u0107 dok\u0142adnie i nie pomijaj \u017Cadnej lekcji. Zwr\xF3\u0107 wy\u0142\u0105cznie poprawny obiekt JSON z tablic\u0105 "lessons".

# FORMAT ODPOWIEDZI
Zwr\xF3\u0107 dok\u0142adnie taki kszta\u0142t, bez komentarzy i bez bloku markdown:
{"lessons":[{"date":"2024-03-12","studentId":"abc123","studentIds":["abc123"],"lessonTopic":"Present Perfect","revisionNotes":"...","vocabularyText":"deadline - termin\\nto meet - spotka\u0107","studentSpeaking":"...","thingsToImprove":"...","suggestedFollowUp":"..."}]}
Gdy w materiale nie ma \u017Cadnej lekcji, zwr\xF3\u0107 {"lessons":[]} \u2014 nigdy nie wymy\u015Blaj lekcji, kt\xF3rych nie ma w tek\u015Bcie.`;
      const schema = {
        type: Type.OBJECT,
        properties: {
          lessons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                studentId: { type: Type.STRING },
                studentIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                lessonTopic: { type: Type.STRING },
                revisionNotes: { type: Type.STRING },
                vocabularyText: { type: Type.STRING },
                studentSpeaking: { type: Type.STRING },
                thingsToImprove: { type: Type.STRING },
                suggestedFollowUp: { type: Type.STRING }
              },
              required: ["date", "studentId", "lessonTopic", "revisionNotes", "vocabularyText"]
            }
          }
        },
        required: ["lessons"]
      };
      let response = await generateContentWithRetry(
        ai,
        contents,
        {
          systemInstruction: sysInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2
        },
        AI_MODEL_CASCADE
      );
      const responseText = response.text;
      if (!responseText) throw new Error("Model nie zwr\xF3ci\u0142 odpowiedzi.");
      const json = extractJsonFromString(responseText);
      if (!json) {
        console.error("[import-lessons-batch] Odpowied\u017A bez poprawnego JSON:", responseText.slice(0, 400));
        throw new Error("Model zwr\xF3ci\u0142 odpowied\u017A, kt\xF3rej nie da si\u0119 odczyta\u0107 jako JSON.");
      }
      const lessons = normalizeImportedLessons(json, {
        today: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        fallbackStudentId: typeof targetStudentId === "string" ? targetStudentId : ""
      });
      const rawCount = Array.isArray(json?.lessons) ? json.lessons.length : 0;
      console.log(`[import-lessons-batch] Model zwr\xF3ci\u0142 ${rawCount} wpis\xF3w, po walidacji: ${lessons.length}`);
      res.json({ lessons });
    } catch (error) {
      console.error("Error in import-lessons-batch:", error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.post("/api/gemini/analyze-student-import", requireFirebaseAdmin, async (req, res) => {
    try {
      const { textContent, pdfBase64 } = req.body;
      if (!textContent && !pdfBase64) {
        return res.status(400).json({ error: "Missing textContent or pdfBase64" });
      }
      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) {
        return res.status(500).json({ error: "AI API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in environment variables." });
      }
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      let parsedDocText = textContent || "";
      let isPdfFallbackNeeded = false;
      if (pdfBase64) {
        try {
          const rawB64 = pdfBase64.split(",")[1] || pdfBase64;
          const pdfBuffer = Buffer.from(rawB64, "base64");
          const pdfData = await pdfParse(pdfBuffer);
          if (pdfData && pdfData.text && pdfData.text.trim().length > 10) {
            parsedDocText = (parsedDocText ? parsedDocText + "\n\n" : "") + pdfData.text;
          } else {
            isPdfFallbackNeeded = true;
          }
        } catch (pdfErr) {
          console.warn("[analyze-student-import] pdf-parse failed, falling back to multi-modal PDF upload:", pdfErr);
          isPdfFallbackNeeded = true;
        }
      }
      const MAX_SOURCE_CHARS = 12e4;
      if (parsedDocText.length > MAX_SOURCE_CHARS) {
        console.warn(`[analyze-student-import] Materia\u0142 ma ${parsedDocText.length} znak\xF3w \u2014 ucinam do ${MAX_SOURCE_CHARS}.`);
        parsedDocText = parsedDocText.slice(0, MAX_SOURCE_CHARS);
      }
      let contents;
      if (isPdfFallbackNeeded && pdfBase64) {
        contents = [{
          role: "user",
          parts: [
            { inlineData: { data: pdfBase64.split(",")[1] || pdfBase64, mimeType: "application/pdf" } },
            { text: "Przeanalizuj powy\u017Cszy plik PDF z profilem i histori\u0105 lekcji nowego kursanta." }
          ]
        }];
      } else {
        contents = [{
          role: "user",
          parts: [{ text: `Tre\u015B\u0107 dokumentu/notatek o kursancie:
${parsedDocText}` }]
        }];
      }
      const sysInstruction = `# Cel
Jeste\u015B skrupulatnym asystentem lektora j\u0119zyka angielskiego weryfikuj\u0105cym profil nowego kursanta przed za\u0142o\u017Ceniem mu konta. Dostajesz plik (notatki, e-mail, wizyt\xF3wk\u0119, histori\u0119 lekcji z innej platformy) i masz wyodr\u0119bni\u0107 z niego dane profilowe oraz histori\u0119 dotychczasowych lekcji.

# CO WYCI\u0104GN\u0104\u0106 (extractedData):
- fullName: imi\u0119 i nazwisko kursanta.
- email: adres e-mail, je\u015Bli wyst\u0119puje w tre\u015Bci.
- level: poziom zaawansowania CEFR \u2014 DOK\u0141ADNIE jedno z: A1, A2, B1, B2, C1, C2. Je\u015Bli nie da si\u0119 jednoznacznie ustali\u0107, pomi\u0144 pole.
- targetGoals: cele nauki kursanta (np. "przygotowanie do rozm\xF3w biznesowych", "matura").
- industry: bran\u017Ca/zaw\xF3d kursanta, je\u015Bli wspomniana.
- generalNotes: inne istotne informacje o kursancie, kt\xF3rych nie da si\u0119 przypisa\u0107 do powy\u017Cszych p\xF3l.
- historicalLessons: lista dotychczasowych lekcji, ka\u017Cda z polami:
  - date: data lekcji w formacie YYYY-MM-DD. Je\u015Bli w \u017Ar\xF3dle brakuje roku (np. "15 maja") lub daty w og\xF3le, ustaw dateAmbiguous: true i podaj najlepsze przybli\u017Cenie (z dzisiejszym rokiem, je\u015Bli rok nieznany).
  - summary: kr\xF3tki opis tematu/przebiegu lekcji.
  - vocabulary: lista s\u0142\xF3wek/zwrot\xF3w om\xF3wionych na lekcji (same stringi, "s\u0142owo - t\u0142umaczenie" je\u015Bli t\u0142umaczenie jest dost\u0119pne).
  - corrections: lista b\u0142\u0119d\xF3w/korekt j\u0119zykowych z lekcji (same stringi).

# ZASADY:
- NIE WYMY\u015ALAJ danych, kt\xF3rych nie ma w tek\u015Bcie. Brakuj\u0105ce pole zostaw puste/pomi\u0144.
- Je\u015Bli w tek\u015Bcie nie ma \u017Cadnej historii lekcji, zwr\xF3\u0107 pust\u0105 tablic\u0119 historicalLessons.
- aiComment: kr\xF3tkie podsumowanie w 1-2 zdaniach PO POLSKU \u2014 co znalaz\u0142e\u015B i na co lektor powinien zwr\xF3ci\u0107 uwag\u0119.
- Zwr\xF3\u0107 wy\u0142\u0105cznie poprawny obiekt JSON zgodny ze schematem, bez komentarzy i bloku markdown.`;
      const schema = {
        type: Type.OBJECT,
        properties: {
          extractedData: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              email: { type: Type.STRING },
              level: { type: Type.STRING },
              targetGoals: { type: Type.STRING },
              industry: { type: Type.STRING },
              generalNotes: { type: Type.STRING },
              historicalLessons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    dateAmbiguous: { type: Type.BOOLEAN },
                    summary: { type: Type.STRING },
                    vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } },
                    corrections: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["date", "summary"]
                }
              }
            },
            required: ["historicalLessons"]
          },
          aiComment: { type: Type.STRING }
        },
        required: ["extractedData", "aiComment"]
      };
      const response = await generateContentWithRetry(
        ai,
        contents,
        {
          systemInstruction: sysInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2
        },
        AI_MODEL_CASCADE
      );
      const responseText = response.text;
      if (!responseText) throw new Error("Model nie zwr\xF3ci\u0142 odpowiedzi.");
      const json = extractJsonFromString(responseText);
      if (!json) {
        console.error("[analyze-student-import] Odpowied\u017A bez poprawnego JSON:", responseText.slice(0, 400));
        throw new Error("Model zwr\xF3ci\u0142 odpowied\u017A, kt\xF3rej nie da si\u0119 odczyta\u0107 jako JSON.");
      }
      const analysis = normalizeStudentImportAnalysis(json, (/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
      res.json({ analysis });
    } catch (error) {
      console.error("Error in analyze-student-import:", error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  const SCENARIO_DIDACTIC_MODEL = "gemini-2.5-pro";
  const SCENARIO_FORMATTING_MODEL = "gemini-2.5-flash";
  function isCompletedLessonRecord(data) {
    if (!data) return false;
    if (data.status === "pending_confirmation" || data.status === "rejected") return false;
    if (data.sessionStatus === "draft" || data.sessionStatus === "live") return false;
    return true;
  }
  app2.post("/api/scenario/generate", requireFirebaseAuth, async (req, res) => {
    try {
      const studentId = String(req.body?.studentId || "").trim();
      const durationMin = Number(req.body?.durationMin);
      if (!studentId) return res.status(400).json({ error: "Nie wskazano kursanta." });
      if (![45, 60, 90].includes(durationMin)) {
        return res.status(400).json({ error: "Nieprawid\u0142owa d\u0142ugo\u015B\u0107 lekcji \u2014 dozwolone: 45, 60, 90 minut." });
      }
      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY nie jest skonfigurowany." });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const studentSnap = await adminDb.collection("users").doc(studentId).get();
      if (!studentSnap.exists) {
        return res.status(404).json({ error: "Nie znaleziono kursanta." });
      }
      const studentData = studentSnap.data() || {};
      const cefr = String(studentData.level || "").trim();
      if (!cefr) {
        return res.status(400).json({ error: "insufficient-profile" });
      }
      const goals = String(studentData.goals || "").trim();
      const industry = String(studentData.industry || "").trim();
      let lastLesson = null;
      try {
        const recordsSnap = await adminDb.collection("users").doc(studentId).collection("lessonRecords").orderBy("date", "desc").limit(10).get();
        for (const docSnap of recordsSnap.docs) {
          const data = docSnap.data();
          if (isCompletedLessonRecord(data)) {
            lastLesson = data;
            break;
          }
        }
      } catch (queryErr) {
        console.warn("[scenario/generate] nie uda\u0142o si\u0119 odczyta\u0107 lessonRecords:", queryErr);
      }
      const mode = lastLesson ? "returning" : "cold_start";
      const lastLessonContext = lastLesson ? `Temat ostatniej lekcji: ${lastLesson.topic || "brak"}
Konkretne sytuacje zawodowe poruszone na lekcji: ${lastLesson.summary || lastLesson.topic || "brak"}
S\u0142ownictwo z ostatniej lekcji: ${lastLesson.vocabularyText || "brak"}
DOK\u0141ADNE b\u0142\u0119dy/korekty z ostatniej lekcji (do recyklingu): ${lastLesson.corrections || lastLesson.thingsToImprove || "brak"}
Plan/kierunek na kolejn\u0105 lekcj\u0119 (z poprzedniej notatki): ${lastLesson.nextLessonPlan || lastLesson.suggestedFollowUp || "brak"}` : "Brak historii lekcji tego kursanta \u2014 to pierwszy scenariusz (cold_start).";
      const profileContext = `Poziom CEFR: ${cefr}
Bran\u017Ca / kontekst zawodowy: ${industry || "brak danych \u2014 nie zgaduj konkretnej bran\u017Cy, trzymaj si\u0119 og\xF3lnego kontekstu zawodowego"}
Cele edukacyjne/zawodowe kursanta: ${goals || "brak danych"}
Preferencje korekty b\u0142\u0119d\xF3w: brak wyodr\u0119bnionego pola w profilu \u2014 koryguj na bie\u017C\u0105co w module "error_work", bez nachalno\u015Bci w pozosta\u0142ych modu\u0142ach`;
      const errorWorkInstruction = mode === "returning" ? 'modu\u0142 "error_work" musi \u0107wiczy\u0107 DOK\u0141ADNIE te b\u0142\u0119dy i to s\u0142ownictwo, kt\xF3re pad\u0142y na OSTATNIEJ lekcji kursanta (patrz kontekst ni\u017Cej) \u2014 konkretne zdania/sytuacje do poprawy, nie og\xF3lna gramatyka.' : 'kursant nie ma jeszcze historii lekcji, wi\u0119c modu\u0142 "error_work" zamienia si\u0119 w \u0107wiczenia DIAGNOSTYCZNE \u2014 kr\xF3tkie zadania sprawdzaj\u0105ce realny poziom wzgl\u0119dem deklarowanego CEFR.';
      const didacticPrompt = `Jeste\u015B do\u015Bwiadczonym metodykiem j\u0119zyka angielskiego (1:1, kursy zawodowe), uk\u0142adaj\u0105cym scenariusz KONKRETNEJ lekcji dla konkretnego lektora i konkretnego kursanta. Nie piszesz podr\u0119cznika ani ankiety ewaluacyjnej \u2014 piszesz notatki robocze dla lektora, kt\xF3ry za chwil\u0119 usi\u0105dzie z t\u0105 osob\u0105.

PROFIL KURSANTA:
${profileContext}

KONTEKST Z OSTATNIEJ LEKCJI:
${lastLessonContext}

PARAMETRY LEKCJI:
D\u0142ugo\u015B\u0107: ${durationMin} minut
Tryb: ${mode === "returning" ? "kursant powracaj\u0105cy (returning)" : "pierwszy kontakt / brak historii (cold_start)"}

TEST NATURALNO\u015ACI (obowi\u0105zkowy, sprawd\u017A ka\u017Cde zdanie przed oddaniem odpowiedzi):
- Ka\u017Cde pytanie i polecenie musi brzmie\u0107 jak \u017Cywa rozmowa dw\xF3ch ludzi, NIGDY jak formularz ewaluacyjny, ankieta HR ani lista kontrolna.
- Zakazane s\u0142owa-klucze i ich polskie odpowiedniki (nie u\u017Cywaj ich w og\xF3le): "headspace", "bandwidth", "leverage", "facilitate", "synergy", "touch base", "circle back", "actionable", "streamline", "usprawni\u0107", "wdro\u017Cy\u0107 synergi\u0119", "przestrze\u0144 mentaln\u0105".
- Je\u015Bli zdanie brzmi jak co\u015B, co powiedzia\u0142by dzia\u0142 HR albo konsultant, przepisz je jak zwyk\u0142\u0105 rozmow\u0119 przy kawie.

STRUKTURA (dok\u0142adnie 4 bloki, w tej kolejno\u015Bci):

1. WARM-UP / FOLLOW-UP \u2014 rozgrzewka zakotwiczona w KONKRETNYM dniu i konkretnym do\u015Bwiadczeniu kursanta (np. nawi\u0105zanie do sytuacji z ostatniej lekcji, konkretnego wydarzenia w pracy, konkretnego dnia tygodnia). Nigdy og\xF3lnikowe "How was your week?" ani "How are you?" bez punktu zaczepienia.

2. PRACA NA B\u0141\u0118DACH \u2014 ${errorWorkInstruction} Podaj konkretne zdania/sytuacje do prze\u0107wiczenia, odwo\u0142uj\u0105ce si\u0119 wprost do b\u0142\u0119d\xF3w i s\u0142ownictwa z kontekstu wy\u017Cej (nie wymy\u015Blaj nowych, niepowi\u0105zanych b\u0142\u0119d\xF3w).

3. G\u0141\xD3WNY TEMAT \u2014 dok\u0142adnie JEDNA konkretna sytuacja z pracy kursanta (np. konkretna linia produkcyjna, konkretny wska\u017Anik/proces, konkretna eskalacja problemu, konkretne spotkanie) \u2014 nie og\xF3lny temat bran\u017Cowy. Rozwi\u0144 j\u0105 w pytania i zadania na poziomie ${cefr}. Dodatkowo przygotuj DLA LEKTORA sekcj\u0119 "Wskaz\xF3wki ratunkowe" \u2014 2-4 prostsze, awaryjne pytania/podpowiedzi na wypadek, gdyby kursant odpowiedzia\u0142 jednym s\u0142owem albo utkn\u0105\u0142 i milcza\u0142. Te wskaz\xF3wki s\u0105 dla lektora, nie dla kursanta.

4. PODSUMOWANIE I FEEDBACK \u2014 kr\xF3tkie podsumowanie lekcji, konkretny feedback dla kursanta, zapowied\u017A pracy domowej nawi\u0105zuj\u0105ca do tematu g\u0142\xF3wnego.

Dla ka\u017Cdego z 4 blok\xF3w podaj jednozdaniowy cel oraz list\u0119 1-6 konkretnych, samodzielnych punkt\xF3w (pyta\u0144/\u0107wicze\u0144/zwrot\xF3w) do realizacji na \u017Cywo. Nie podawaj czas\xF3w trwania ani identyfikator\xF3w. Odpowiedz zwyk\u0142ym tekstem, jasno opisuj\u0105c bloki po kolei \u2014 o formatowanie do JSON zadba kolejny etap.`;
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const didacticResponse = await generateContentWithRetry(
        ai,
        didacticPrompt,
        {},
        [SCENARIO_DIDACTIC_MODEL, ...GEMINI_MODEL_CASCADE]
      );
      if (!didacticResponse.text) throw new Error("Brak odpowiedzi z modelu dydaktycznego AI.");
      const didacticText = String(didacticResponse.text).trim();
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
                    required: ["text"]
                  }
                },
                teacherNotes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["moduleId", "objective", "items"]
            }
          }
        },
        required: ["modules"]
      };
      const formattingPrompt = `Poni\u017Cej jest gotowy merytorycznie scenariusz lekcji, u\u0142o\u017Cony przez metodyka. Twoje jedyne zadanie: przepisa\u0107 go WIERNIE (bez zmiany tre\u015Bci, bez skracania, bez parafrazowania) na struktur\u0119 JSON zgodn\u0105 ze schematem.

Zasady przepisania:
- DOK\u0141ADNIE 4 modu\u0142y w tej kolejno\u015Bci: "warmup_followup", "error_work", "main_topic", "wrapup_feedback".
- Ka\u017Cdy modu\u0142: "objective" (jednozdaniowy cel z tekstu), "items" (1-6 punkt\xF3w \u2014 ka\u017Cdy punkt jako osobny, samodzielny tekst, bez numeracji i bez markdown).
- Modu\u0142 "main_topic" musi mie\u0107 dodatkowo "teacherNotes": list\u0119 wskaz\xF3wek ratunkowych dla lektora z tekstu (sekcja "Wskaz\xF3wki ratunkowe") \u2014 je\u015Bli tekst nie nazywa ich wprost, wyodr\u0119bnij zdania, kt\xF3re pe\u0142ni\u0105 t\u0119 funkcj\u0119.
- Nie dodawaj w\u0142asnej tre\u015Bci, nie koryguj merytoryki \u2014 tylko formatowanie.

SCENARIUSZ DO PRZEPISANIA:
${didacticText}`;
      const response = await generateContentWithRetry(
        ai,
        formattingPrompt,
        { responseMimeType: "application/json", responseSchema: schema },
        [SCENARIO_FORMATTING_MODEL, ...GEMINI_MODEL_CASCADE]
      );
      if (!response.text) throw new Error("Brak odpowiedzi z modelu formatuj\u0105cego AI.");
      let cleanText = String(response.text).replace(/^```json\n?/g, "").replace(/```$/g, "").trim();
      const parsed = JSON.parse(cleanText);
      validateScenarioModelOutput(parsed);
      const scenario = buildLessonScenario(
        parsed,
        { studentId, durationMin, mode, generatedAt: (/* @__PURE__ */ new Date()).toISOString() },
        randomUUID2
      );
      return res.json({ scenario });
    } catch (err) {
      console.error("[server] b\u0142\u0105d generowania scenariusza lekcji:", err);
      return res.status(500).json({ error: err?.message || "Nie uda\u0142o si\u0119 wygenerowa\u0107 scenariusza." });
    }
  });
  app2.post("/api/scenario/save", requireFirebaseAuth, async (req, res) => {
    try {
      const studentId = String(req.body?.studentId || "").trim();
      const targetLessonId = String(req.body?.targetLessonId || "").trim();
      const scenario = req.body?.scenario;
      if (!studentId) return res.status(400).json({ error: "Nie wskazano kursanta." });
      if (!targetLessonId) return res.status(400).json({ error: "Nie wskazano lekcji docelowej." });
      if (!scenario || !Array.isArray(scenario.modules)) {
        return res.status(400).json({ error: "Brak poprawnego scenariusza do zapisania." });
      }
      const adminApp2 = getAdminApp();
      const adminDb = getFirestore2(adminApp2, FIRESTORE_DATABASE_ID);
      const recordRef = adminDb.collection("users").doc(studentId).collection("lessonRecords").doc(targetLessonId);
      const recordSnap = await recordRef.get();
      if (!recordSnap.exists) {
        return res.status(404).json({ error: "Nie znaleziono lekcji docelowej." });
      }
      const scenarioSavedAt = (/* @__PURE__ */ new Date()).toISOString();
      await recordRef.update({ plannedScenario: scenario, scenarioSavedAt });
      return res.json({ ok: true, scenarioSavedAt });
    } catch (err) {
      console.error("[server] b\u0142\u0105d zapisu scenariusza lekcji:", err);
      return res.status(500).json({ error: err?.message || "Nie uda\u0142o si\u0119 zapisa\u0107 scenariusza." });
    }
  });
  app2.post("/api/gemini/lesson-summary", requireFirebaseAdmin, async (req, res) => {
    try {
      const { notes, pdfBase64, driveFile, students, mode } = req.body;
      const isTranscript = mode === "transcript";
      if (!notes && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: "Missing notes, pdfBase64 or driveFile" });
      }
      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) {
        return res.status(500).json({ error: "AI API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in environment variables." });
      }
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      const studentsListStr = typeof students === "string" ? students : Array.isArray(students) ? students.map((s) => `ID: ${s.id} | Imi\u0119/Nazwisko: ${s.name || s.username || ""} | Poziom: ${s.level || ""} | Opis: ${s.description || ""}`).join("\n") : "Brak bazy kursant\xF3w";
      let promptContext = [];
      if (driveFile) {
        const url = driveFile.mimeType === "application/pdf" ? `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media` : `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=text/plain`;
        const fetchRes = await fetch(url, { headers: { Authorization: `Bearer ${driveFile.token}` } });
        if (!fetchRes.ok) throw new Error("Failed to fetch from Google Drive: " + await fetchRes.text());
        if (driveFile.mimeType === "application/pdf") {
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          promptContext = [{
            role: "user",
            parts: [
              {
                inlineData: {
                  data: buffer.toString("base64"),
                  mimeType: "application/pdf"
                }
              },
              { text: `Baza kursant\xF3w:
${studentsListStr}

Powy\u017Cej znajduje si\u0119 plik PDF ${isTranscript ? "z TRANSKRYPCJ\u0104 lekcji (zapisem rozmowy)" : "z notatkami z lekcji"}. Przeanalizuj go.` }
            ]
          }];
        } else {
          const text2 = await fetchRes.text();
          promptContext = [{
            role: "user",
            parts: [{ text: `Baza kursant\xF3w:
${studentsListStr}

Transkrypcja/Notatki ze spotkania (Google Docs / Text):
${text2}` }]
          }];
        }
      } else if (pdfBase64) {
        promptContext = [{
          role: "user",
          parts: [
            {
              inlineData: {
                data: pdfBase64.split(",")[1] || pdfBase64,
                mimeType: "application/pdf"
              }
            },
            { text: `Baza kursant\xF3w:
${studentsListStr}

Powy\u017Cej znajduje si\u0119 plik PDF ${isTranscript ? "z TRANSKRYPCJ\u0104 lekcji (zapisem rozmowy)" : "z notatkami z lekcji"}. Przeanalizuj go.` }
          ]
        }];
      } else {
        promptContext = [{
          role: "user",
          parts: [{ text: `Baza kursant\xF3w:
${studentsListStr}

${isTranscript ? "SUROWA TRANSKRYPCJA LEKCJI (zapis rozmowy)" : "Notatki ze spotkania"}:
${notes}` }]
        }];
      }
      const transcriptInstruction = `# Cel
Dostajesz SUROW\u0104 TRANSKRYPCJ\u0118 lekcji j\u0119zyka angielskiego (zapis rozmowy lektora z kursantem) albo plik z takim zapisem.
Twoim zadaniem jest wydoby\u0107 z niej WSZYSTKIE informacje o warto\u015Bci dydaktycznej i u\u0142o\u017Cy\u0107 je w STANDARDOWY UK\u0141AD BLOK\xD3W, kt\xF3ry kursant i lektor widz\u0105 w historii lekcji.
To nie jest streszczanie. To porz\u0105dkowanie: nic, co pad\u0142o w rozmowie i ma warto\u015B\u0107 do nauki, nie mo\u017Ce znikn\u0105\u0107.

# Czego szukasz w zapisie rozmowy
Przejd\u017A transkrypcj\u0119 od pocz\u0105tku do ko\u0144ca i wynotuj:
- KA\u017BDE s\u0142owo, zwrot, kolokacj\u0119 i idiom, kt\xF3re lektor poda\u0142, wyja\u015Bni\u0142, przet\u0142umaczy\u0142 albo poprawi\u0142 \u2014 r\xF3wnie\u017C te wplecione w zdanie i nigdzie nie wypisane,
- KA\u017BD\u0104 poprawk\u0119 b\u0142\u0119du kursanta: co powiedzia\u0142 \u017Ale i jak brzmi poprawnie,
- uwagi o wymowie (akcent wyrazowy, konkretne g\u0142oski, intonacja),
- zagadnienia gramatyczne, kt\xF3re by\u0142y omawiane lub \u0107wiczone,
- ustalenia na przysz\u0142o\u015B\u0107 i wszystko, co lektor zapowiedzia\u0142 albo zada\u0142,
- czym kursant si\u0119 zajmuje i o czym m\xF3wi\u0142 \u2014 to materia\u0142 na kolejne lekcje.
Pomijaj wy\u0142\u0105cznie to, co nie niesie tre\u015Bci: powitania, \u201Eyhy", problemy techniczne, ustalanie terminu, przerwy.

# Zasady
- Wszystkie pola opisowe pisz PO POLSKU. S\u0142ownictwo naturalnie dwuj\u0119zycznie: "angielskie s\u0142owo - polskie t\u0142umaczenie".
- NIE WYMY\u015ALAJ niczego, czego nie ma w zapisie. Je\u015Bli w rozmowie brakuje materia\u0142u do danego pola, wpisz: Brak danych w transkrypcji.
- Prac\u0119 domow\u0105 u\u0142\xF3\u017C na podstawie materia\u0142u z TEJ lekcji (s\u0142ownictwo i b\u0142\u0119dy, kt\xF3re faktycznie pad\u0142y), a nie z niczego. Je\u015Bli lektor zada\u0142 co\u015B wprost \u2014 to jest praca domowa i przepisz j\u0105 dok\u0142adnie.
- Daty nie zgaduj: je\u015Bli w zapisie nie pad\u0142a, zostaw pole date puste.

# Zanim wygenerujesz
Na podstawie podanej bazy kursant\xF3w dopasuj studentId oraz studentIds (gdy lekcja by\u0142a grupowa). Dostosuj poziom j\u0119zyka do profilu kursanta.

# Zwr\xF3\u0107 JSON o polach
- studentId (string, ID g\u0142\xF3wnego kursanta z bazy; puste, gdy nie da si\u0119 dopasowa\u0107)
- studentIds (array of strings, wszyscy kursanci tej lekcji)
- date (string, YYYY-MM-DD \u2014 wy\u0142\u0105cznie je\u015Bli data pad\u0142a w zapisie; inaczej puste)
- lessonTopic (string, zwi\u0119z\u0142e has\u0142o tematu, maksymalnie 50 znak\xF3w, bez daty)
- revisionNotes (string, BLOK 1 \u201ELekcja w skr\xF3cie": przebieg lekcji po polsku, 4-8 zda\u0144 \u2014 co \u0107wiczyli\u015Bcie i w jakiej kolejno\u015Bci)
- vocabularyText (string, BLOK 2 \u201EKey Language": ka\u017Cde s\u0142\xF3wko i zwrot w osobnej linii, \u015Bci\u015Ble "angielskie - polskie". Bez punktor\xF3w, bez markdown, bez numeracji.)
- corrections (string, BLOK 2b \u201EKorekty i wymowa": poprawki w formacie "\u274C to, co powiedzia\u0142 kursant \u2192 \u2705 poprawna wersja", po jednej na lini\u0119, z kr\xF3tkim wyja\u015Bnieniem po polsku, gdy jest potrzebne. Tu trafiaj\u0105 te\u017C uwagi o wymowie.)
- homeworkText (string, BLOK 3 \u201EHomework": konkretne zadanie oparte na materiale z tej lekcji \u2014 np. 8-10 ponumerowanych zda\u0144 do przet\u0142umaczenia z polskiego na angielski, wykorzystuj\u0105cych nowe s\u0142ownictwo i poprawione b\u0142\u0119dy. Bez odpowiedzi.)
- homeworkAnswerKey (string, BLOK 3b \u201EKlucz odpowiedzi": odpowiedzi do zadania wy\u017Cej, ta sama numeracja, nic poza nimi)
- nextLessonPlan (string, BLOK 4 \u201ENext Lesson": ustalenia i najlepsze tematy na kolejne zaj\u0119cia, po polsku)
- studentSpeaking (string, \u201ELearning Curve": 5-6 zda\u0144 po polsku, neutralnie \u2014 o czym kursant m\xF3wi\u0142, jak mu sz\u0142o, co go interesuje)
- thingsToImprove (string, ta sama tre\u015B\u0107 co corrections \u2014 dla zgodno\u015Bci ze starszymi widokami)
- suggestedFollowUp (string, ta sama tre\u015B\u0107 co nextLessonPlan \u2014 dla zgodno\u015Bci ze starszymi widokami)
`;
      const sysInstruction = `# Cel
Na podstawie AI meeting notes przygotuj podsumowanie lekcji j\u0119zyka angielskiego dla kursanta.
\u0179r\xF3d\u0142em danych jest gotowe podsumowanie spotkania. Je\u015Bli gotowe podsumowanie jest niewystarczaj\u0105ce, u\u017Cyj pe\u0142nej transkrypcji.
Ta wersja promptu s\u0142u\u017Cy do uzupe\u0142niania p\xF3l w aplikacji Cribro. Ka\u017Cda sekcja ma odpowiada\u0107 jednemu polu w aplikacji.
Nie generuj pracy domowej, zda\u0144 do t\u0142umaczenia, \u0107wicze\u0144 z lukami ani zada\u0144 spaced repetition.
Wszystkie pola opisowe (revisionNotes, studentSpeaking, thingsToImprove, suggestedFollowUp) wygeneruj w j\u0119zyku polskim. S\u0142ownictwo naturalnie ma by\u0107 w dw\xF3ch j\u0119zykach (s\u0142owo angielskie - polskie t\u0142umaczenie).
Je\u015Bli w materiale brakuje danych do danej sekcji, wpisz po polsku:
Brak danych w transkrypcji.

# Zanim wygenerujesz
Zidentyfikuj kursanta lub kursant\xF3w, kt\xF3rych dotyczy lekcja na podstawie podanej bazy kursant\xF3w i dopasuj studentId oraz studentIds (je\u015Bli to lekcja grupowa dla kilku kursant\xF3w). Dostosuj poziom j\u0119zyka i szczeg\xF3\u0142owo\u015B\u0107 tre\u015Bci do profilu kursant\xF3w.

# Wygeneruj wynik w formacie JSON
Zwr\xF3\u0107 wynik jako JSON z poni\u017Cszymi polami:
- studentId (string, ID g\u0142\xF3wnego wybranego kursanta z Bazy Kursant\xF3w, je\u015Bli nie potrafisz dopasowa\u0107 zostaw puste)
- studentIds (array of strings, Lista ID wszystkich kursant\xF3w z Bazy Kursant\xF3w, je\u015Bli lekcja dotyczy\u0142a grupy lub kilku os\xF3b)
- lessonTopic (string, Kr\xF3tkie, jednozdaniowe podsumowanie tematu lekcji na podstawie revision notes. Maksymalnie 50 znak\xF3w, bez daty, zwi\u0119z\u0142e has\u0142o bez wielocz\u0119\u015Bciowych zda\u0144.)
- revisionNotes (string, Kr\xF3tkie podsumowanie lekcji w stronie biernej po polsku, 3-6 zda\u0144)
- vocabularyText (string, Wyodr\u0119bnij WSZYSTKIE s\u0142\xF3wka, zwroty i idiomy, kt\xF3re pojawiaj\u0105 si\u0119 w notatkach z lekcji. Nawet je\u015Bli s\u0105 zapisane ci\u0105giem (nie w kolumnie) lub wplecione w tekst, wy\u0142uskaj DOK\u0141ADNIE KA\u017BDE z nich. U\u0142\xF3\u017C je \u015Bci\u015Ble w formacie: "s\u0142owo_angielskie - polskie_t\u0142umaczenie" w osobnych linijkach. Uwa\u017Caj, aby nie pomin\u0105\u0107 \u017Cadnego s\u0142owa. Do not include markdown formatting or bullet points.)
- studentSpeaking (string, Kr\xF3tkie memory o kursancie po polsku, 5-6 zda\u0144 neutralnie o czym m\xF3wi\u0142, styl itp.)
- thingsToImprove (string, 2-3 obszary wymagaj\u0105ce poprawy z diagnoz\u0105 i przyk\u0142adami, po polsku)
- suggestedFollowUp (string, Ustalenia i najlepsze tematy na kolejn\u0105 lekcj\u0119, po polsku)
`;
      const schema = {
        type: Type.OBJECT,
        properties: {
          studentId: { type: Type.STRING },
          studentIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          lessonTopic: { type: Type.STRING },
          revisionNotes: { type: Type.STRING },
          vocabularyText: { type: Type.STRING },
          studentSpeaking: { type: Type.STRING },
          thingsToImprove: { type: Type.STRING },
          suggestedFollowUp: { type: Type.STRING },
          /* Bloki 2b-4 wprost. Wersja notatkowa ich nie wypełnia i nie musi —
             pola są opcjonalne, więc schemat jest jeden dla obu trybów. */
          date: { type: Type.STRING },
          corrections: { type: Type.STRING },
          homeworkText: { type: Type.STRING },
          homeworkAnswerKey: { type: Type.STRING },
          nextLessonPlan: { type: Type.STRING }
        },
        required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText", "studentSpeaking", "thingsToImprove", "suggestedFollowUp"]
      };
      let response = await generateContentWithRetry(ai, promptContext, {
        systemInstruction: isTranscript ? transcriptInstruction : sysInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      });
      const text = response.text;
      if (!text) throw new Error("No response from Gemini");
      const json = JSON.parse(text);
      res.json(json);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  app2.post("/api/gemini/grade-test", requireFirebaseAuth, async (req, res) => {
    try {
      const { testTitle, questions, studentAnswers } = req.body;
      const prompt = `Jeste\u015B nauczycielem j\u0119zyka angielskiego. Sprawd\u017A odpowiedzi ucznia w te\u015Bcie o tytule "${testTitle}".
Oto pytania i odpowiedzi ucznia:
${questions.map((q, index) => {
        return `
Zadanie ${index + 1}. [${q.type}]
Polecenie/Tre\u015B\u0107: ${q.prompt}
Odpowied\u017A ucznia: ${studentAnswers[q.id] || "Brak odpowiedzi"}
Poprawna odpowied\u017A (dla zada\u0144 zamkni\u0119tych): ${q.correctAnswer || "Zadanie otwarte/writing"}`;
      }).join("\n")}

Twoim zadaniem jest oceni\u0107 ten test i dostarczy\u0107 konstruktywny, motywuj\u0105cy feedback dla kursanta w j\u0119zyku polskim.
Przeanalizuj ka\u017Cd\u0105 odpowied\u017A ucznia. Zwr\xF3\u0107 szczeg\xF3ln\u0105 uwag\u0119 na zadania typu "find_mistake" (czy ucze\u0144 poprawnie naprawi\u0142 b\u0142\u0105d w zdaniu i zachowa\u0142 poprawn\u0105 struktur\u0119) oraz "writing" - wska\u017C b\u0142\u0119dy, ale te\u017C pochwal za dobre u\u017Cycie struktur.
ZASADA INTERPUNKCJI: Pami\u0119taj, \u017Ce interpunkcja (kropki, przecinki, wielkie litery) jest potrzebna i jest dobr\u0105 praktyk\u0105, ale NIE MO\u017BE obni\u017Ca\u0107 oceny ani powodowa\u0107 odejmowania punkt\xF3w.
Na koniec przyznaj \u0142\u0105czn\u0105 ocen\u0119 (np. w procentach lub punktach).

Zwr\xF3\u0107 JSON z polami:
- score (liczba, przyznane punkty ca\u0142kowite)
- feedback (string, Tw\xF3j szczeg\xF3\u0142owy feedback dla ucznia, z wylistowanymi b\u0142\u0119dami i poradami)
`;
      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) return res.status(500).json({ error: "AI API key not configured." });
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      const response = await generateContentWithRetry(ai, prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING }
          },
          required: ["score", "feedback"]
        }
      });
      if (!response.text) throw new Error("No response");
      res.json(JSON.parse(response.text));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/gemini/student-stats-summary", requireFirebaseAuth, async (req, res) => {
    try {
      const { stats, logsSummary, language } = req.body;
      const geminiApiKey = getGeminiApiKey();
      const openaiApiKey = getOpenAIApiKey();
      if (!geminiApiKey && !openaiApiKey) {
        return res.status(500).json({ error: "No AI API key configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in environment variables." });
      }
      const ai = new GoogleGenAI({ apiKey: geminiApiKey || "DUMMY" });
      const isPl = language !== "en";
      const prompt = `Jeste\u015B do\u015Bwiadczonym, empatycznym i wybitnym metodykiem oraz nauczycielem j\u0119zyka angielskiego (ELT Pedagogical Specialist & Language Coach).
Twoim zadaniem jest przedstawienie kompleksowego, merytorycznego i metodycznego komentarza dla kursanta na podstawie analizy jego wynik\xF3w w \u0107wiczeniach j\u0119zykowych.

Oto statystyki liczbowe kursanta:
- \u0141\u0105czna liczba sesji \u0107wiczeniowych: ${stats?.totalExercises || 0}
- \u015Aredni wynik procentowy poprawno\u015Bci: ${stats?.averageScore || 0}%
- Przet\u0142umaczone zdania/s\u0142owa: ${stats?.totalWords || 0}
- Obecny streak (dni nauki z rz\u0119du): ${stats?.currentStreak || 0}
- Najd\u0142u\u017Cszy streak: ${stats?.longestStreak || 0}

Oto analiza wykonanych zda\u0144 i szczeg\xF3\u0142owych log\xF3w \u0107wicze\u0144:
${logsSummary || "Brak szczeg\xF3\u0142owych zda\u0144 z \u0107wicze\u0144."}

Wype\u0142nij poni\u017Csze pola w j\u0119zyku ${isPl ? "polskim" : "angielskim"}:
1. "overallTeacherCommentary": Merytoryczny i metodyczny podsumowuj\u0105cy komentarz nauczyciela j\u0119zyka angielskiego (2-3 warto\u015Bciowe akapity). Odnie\u015B si\u0119 do konkretnych struktur, kt\xF3re kursant opanowa\u0142 oraz do b\u0142\u0119d\xF3w, kt\xF3re pope\u0142nia. Podaj wyja\u015Bnienie dlaczego dany b\u0142\u0105d powstaje (np. kalka z j\u0119zyka polskiego, niepoprawny czas, z\u0142e przyimki) i jak go unika\u0107. U\u017Cywaj zach\u0119caj\u0105cego, profesjonalnego tonu.
2. "keyStrengths": Tablica 2-4 konkretnych punkt\xF3w / mocnych stron w opanowaniu angielskiego.
3. "areasToImprove": Tablica 2-4 konkretnych zagadnie\u0144 gramatycznych lub leksykalnych do dalszego \u0107wiczenia.
4. "pedagogicalTip": 1-2 zdaniowa praktyczna poradnikowa wskaz\xF3wka metodyczna na nadchodz\u0105ce sesje.

Zwr\xF3\u0107 obiekt JSON z polami: overallTeacherCommentary (string), keyStrengths (array of strings), areasToImprove (array of strings), pedagogicalTip (string).`;
      const response = await generateContentWithRetry(ai, prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallTeacherCommentary: { type: Type.STRING },
            keyStrengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            areasToImprove: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            pedagogicalTip: { type: Type.STRING }
          },
          required: ["overallTeacherCommentary", "keyStrengths", "areasToImprove", "pedagogicalTip"]
        }
      }, AI_MODEL_CASCADE);
      if (!response.text) throw new Error("No response from AI");
      let cleanText = response.text;
      cleanText = cleanText.replace(/^```json\n?/g, "").replace(/```$/g, "").trim();
      res.json(JSON.parse(cleanText));
    } catch (err) {
      console.error("Error in student-stats-summary endpoint:", err);
      res.status(500).json({ error: formatErrorString(err) });
    }
  });
  const handleTTS = async (req, res) => {
    const origin = req.headers.origin;
    const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
    if (origin && allowed.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const idToken = bearer || String(req.query.t || "");
    if (!idToken || idToken === "null" || idToken === "undefined") {
      return res.status(401).json({ error: "Missing Bearer token" });
    }
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch (err) {
      console.warn("[TTS] Auth token verification failed:", err.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    try {
      const text = req.body?.text || req.query.text;
      const lang = req.body?.accent || req.body?.lang || req.query.lang || req.query.accent || "en-US";
      const gender = req.body?.gender || req.query.gender || "male";
      const speed = parseFloat(req.body?.speed || req.query.speed || "1.0") || 1;
      const engine = req.body?.engine || req.query.engine || "auto";
      const isUK = lang === "UK" || lang === "en-GB" || lang === "BrE";
      const isMale = gender === "male" || gender === "m" || !gender.includes("female") && !gender.includes("f");
      if (!text) {
        return res.status(400).json({ error: "Missing text parameter" });
      }
      const trimmedText = text.replace(/<[^>]+>/g, "").trim();
      const formattedText = /[.?!]$/.test(trimmedText) ? trimmedText : `${trimmedText}.`;
      const crypto = await import("crypto");
      const hash = crypto.default.createHash("sha256").update(`${formattedText}_${isUK ? "UK" : "US"}_${isMale ? "M" : "F"}_${speed.toFixed(2)}_${engine}`).digest("hex");
      const fileName = `tts_cache/${hash}.mp3`;
      const os = await import("os");
      const path2 = await import("path");
      const fs2 = await import("fs/promises");
      const localCacheDir = path2.join(os.tmpdir(), "tts_cache");
      await fs2.mkdir(localCacheDir, { recursive: true });
      const localFileName = path2.join(localCacheDir, `${hash}.mp3`);
      try {
        const localBuffer = await fs2.readFile(localFileName);
        res.set({
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=31536000",
          "Accept-Ranges": "bytes"
        });
        return res.send(localBuffer);
      } catch (e) {
      }
      let bucket = null;
      try {
        const { getStorage } = await import("firebase-admin/storage");
        const fbConfig = (await Promise.resolve().then(() => __toESM(require_firebase_applet_config(), 1))).default;
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || fbConfig.storageBucket || "gen-lang-client-0425391821.firebasestorage.app";
        if (bucketName) {
          bucket = getStorage().bucket(bucketName);
          const file = bucket.file(fileName);
          const [exists] = await file.exists();
          if (exists) {
            const [audioBuffer] = await file.download();
            fs2.writeFile(localFileName, audioBuffer).catch(() => {
            });
            res.set({
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=31536000",
              "Accept-Ranges": "bytes"
            });
            return res.send(audioBuffer);
          }
        }
      } catch (err) {
      }
      let finalAudioBuffer = null;
      let contentType = "audio/mpeg";
      const openaiKey = getOpenAIApiKey();
      const openAiVoice = isUK ? isMale ? "fable" : "shimmer" : isMale ? "echo" : "nova";
      if (!finalAudioBuffer && (engine === "auto" || engine === "openai") && openaiKey) {
        try {
          const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "tts-1",
              input: formattedText,
              voice: openAiVoice,
              speed: Math.max(0.75, Math.min(1.25, speed))
            })
          });
          if (response.ok) {
            finalAudioBuffer = Buffer.from(await response.arrayBuffer());
            contentType = "audio/mpeg";
          } else {
            const errTxt = await response.text();
            console.warn(`[TTS Tier 1 - OpenAI tts-1] API error (${response.status}): ${errTxt.slice(0, 150)}`);
          }
        } catch (e) {
          console.warn("[TTS Tier 1 - OpenAI tts-1] Request failed:", e.message || e);
        }
      }
      if (!finalAudioBuffer && (engine === "auto" || engine === "gpt4o-mini" || engine === "openai") && openaiKey) {
        try {
          const miniAudioResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-4o-mini-audio-preview",
              modalities: ["text", "audio"],
              audio: {
                voice: openAiVoice,
                format: "mp3"
              },
              messages: [
                {
                  role: "system",
                  content: "You are a clean text-to-speech voice synthesizer. Say the provided text clearly and naturally, without any conversational preamble or pleasantries."
                },
                {
                  role: "user",
                  content: formattedText
                }
              ]
            })
          });
          if (miniAudioResponse.ok) {
            const miniData = await miniAudioResponse.json();
            const audioBase64 = miniData?.choices?.[0]?.message?.audio?.data;
            if (audioBase64) {
              finalAudioBuffer = Buffer.from(audioBase64, "base64");
              contentType = "audio/mpeg";
            }
          } else {
            const hdResponse = await fetch("https://api.openai.com/v1/audio/speech", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: "tts-1-hd",
                input: formattedText,
                voice: openAiVoice,
                speed: Math.max(0.75, Math.min(1.25, speed))
              })
            });
            if (hdResponse.ok) {
              finalAudioBuffer = Buffer.from(await hdResponse.arrayBuffer());
              contentType = "audio/mpeg";
            }
          }
        } catch (e) {
          console.warn("[TTS Tier 2 - gpt-4o-mini-tts] Request failed:", e.message || e);
        }
      }
      const geminiKey = getGeminiApiKey();
      if (!finalAudioBuffer && (engine === "auto" || engine === "gemini") && geminiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const voiceName = isMale ? "Puck" : "Kore";
          const modelsToTry = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash"];
          for (const m of modelsToTry) {
            try {
              const geminiResponse = await ai.models.generateContent({
                model: m,
                contents: [{ parts: [{ text: `Say clearly with natural pronunciation: ${formattedText}` }] }],
                config: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName }
                    }
                  }
                }
              });
              const base64Audio = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                const rawMime = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "audio/wav";
                finalAudioBuffer = Buffer.from(base64Audio, "base64");
                contentType = rawMime;
                break;
              }
            } catch (innerE) {
              console.warn(`[TTS Tier 3 - Gemini Audio ${m}] failed:`, innerE.message || innerE);
            }
          }
        } catch (e) {
          console.warn("[TTS Tier 3 - Gemini Audio] generation failed:", e.message || e);
        }
      }
      if (finalAudioBuffer) {
        fs2.writeFile(localFileName, finalAudioBuffer).catch(() => {
        });
        if (bucket) {
          const file = bucket.file(fileName);
          file.save(finalAudioBuffer, {
            metadata: { contentType }
          }).catch((e) => console.warn("Firebase Storage cache write:", e.message || e));
        }
        res.set({
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
          "Accept-Ranges": "bytes"
        });
        return res.send(finalAudioBuffer);
      }
      return res.status(503).json({ error: "Us\u0142uga TTS chwilowo niedost\u0119pna na serwerze." });
    } catch (error) {
      console.error("[TTS] error:", error.message || error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  };
  app2.get("/api/tts", handleTTS);
  app2.post("/api/tts", handleTTS);
  const handleOpenAI = async (req, res) => {
    try {
      const { prompt, systemInstruction, isJson, messages, model } = req.body || {};
      if (!prompt && !messages) return res.status(400).json({ error: "Missing prompt or messages" });
      const openaiKey = getOpenAIApiKey();
      const geminiKey = getGeminiApiKey();
      let sysInst = systemInstruction || "";
      if (isJson && !sysInst.toLowerCase().includes("json")) {
        sysInst = (sysInst ? sysInst + "\n\n" : "") + "Respond in valid JSON format.";
      }
      let chatMessages = [];
      if (sysInst) {
        chatMessages.push({ role: "system", content: sysInst });
      }
      if (Array.isArray(messages) && messages.length > 0) {
        for (const m of messages) {
          if (m && typeof m === "object" && m.content) {
            chatMessages.push({
              role: m.role === "system" || m.role === "assistant" || m.role === "user" ? m.role : "user",
              content: String(m.content)
            });
          }
        }
      } else {
        let userPrompt = String(prompt || "");
        if (isJson && !userPrompt.toLowerCase().includes("json")) {
          userPrompt += "\n\n(Output must be in valid JSON format)";
        }
        chatMessages.push({ role: "user", content: userPrompt || "Generate content" });
      }
      const openAiModels = openAiModelsFor(model);
      let openAiSuccess = false;
      let resultText = "";
      let usedModel = "";
      if (openaiKey) {
        for (const modelName of openAiModels) {
          const actualApiTarget = mapToActualOpenAIModel2(modelName);
          console.log(`OpenAI Pipeline -> Wywo\u0142uj\u0119 model: ${modelName} (target API: ${actualApiTarget})`);
          try {
            const bodyPayload = {
              model: actualApiTarget,
              messages: chatMessages,
              temperature: 0.7
            };
            if (isJson) {
              bodyPayload.response_format = { type: "json_object" };
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6e4);
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openaiKey}`
              },
              body: JSON.stringify(bodyPayload),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              const data = await response.json();
              const content = data.choices?.[0]?.message?.content || "";
              if (content) {
                resultText = content;
                usedModel = modelName;
                openAiSuccess = true;
                break;
              }
            } else {
              const errText = await response.text();
              console.warn(`OpenAI model ${modelName} failed with status ${response.status}: ${errText}`);
              if (response.status === 401 || errText.includes("insufficient_quota")) {
                console.warn("OpenAI API key invalid or quota exceeded. Skipping remaining OpenAI models.");
                break;
              }
            }
          } catch (mErr) {
            console.warn(`OpenAI model ${modelName} exception:`, mErr?.message || mErr);
          }
        }
      } else {
        console.warn("OPENAI_API_KEY missing on server.");
      }
      if (openAiSuccess && resultText) {
        return res.json({ text: resultText, modelUsed: usedModel });
      }
      console.log("OpenAI Fallback -> Prze\u0142\u0105czam na model Gemini. Key present:", Boolean(geminiKey));
      if (geminiKey) {
        const geminiModels = GEMINI_MODEL_CASCADE;
        for (const gModel of geminiModels) {
          let gRetries = 2;
          while (gRetries > 0) {
            try {
              const ai = new GoogleGenAI({ apiKey: geminiKey });
              let fullPrompt = prompt || "";
              if (!fullPrompt && Array.isArray(messages)) {
                fullPrompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
              }
              const geminiConfig = {};
              if (systemInstruction) {
                geminiConfig.systemInstruction = systemInstruction;
              }
              if (isJson) {
                geminiConfig.responseMimeType = "application/json";
              }
              const geminiRes = await ai.models.generateContent({
                model: gModel,
                contents: fullPrompt,
                config: geminiConfig
              });
              if (geminiRes.text) {
                return res.json({ text: geminiRes.text, modelUsed: gModel });
              }
            } catch (gErr) {
              console.warn(`Gemini fallback ${gModel} exception (retries left ${gRetries - 1}):`, gErr?.message || gErr);
              gRetries--;
              if (gRetries > 0) {
                await new Promise((r) => setTimeout(r, 1e3));
              }
            }
          }
        }
      }
      return res.status(503).json({ error: "Us\u0142uga AI jest chwilowo niedost\u0119pna." });
    } catch (err) {
      console.error("OpenAI handler error:", err);
      return res.status(503).json({ error: "Us\u0142uga AI jest chwilowo niedost\u0119pna." });
    }
  };
  const handleAnthropic = async (req, res) => {
    try {
      const { prompt, systemInstruction, messages, model, max_tokens, isJson } = req.body || {};
      if (!prompt && !messages) return res.status(400).json({ error: "Missing prompt or messages" });
      const anthropicKey = getAnthropicApiKey();
      if (!anthropicKey) {
        console.warn("[Anthropic] Brak ANTHROPIC_API_KEY na serwerze.");
        return res.status(503).json({ error: "Brak skonfigurowanego klucza Anthropic API (ANTHROPIC_API_KEY)." });
      }
      let sysInst = systemInstruction || "";
      if (isJson && !sysInst.toLowerCase().includes("json")) {
        sysInst = (sysInst ? sysInst + "\n\n" : "") + "Respond in valid JSON format only.";
      }
      let chatMessages = [];
      if (Array.isArray(messages) && messages.length > 0) {
        for (const m of messages) {
          if (m && typeof m === "object" && m.content) {
            chatMessages.push({
              role: m.role === "assistant" ? "assistant" : "user",
              content: String(m.content)
            });
          }
        }
      } else {
        let userPrompt = String(prompt || "");
        if (isJson && !userPrompt.toLowerCase().includes("json")) {
          userPrompt += "\n\n(Output must be valid JSON)";
        }
        chatMessages.push({ role: "user", content: userPrompt || "Generate content" });
      }
      const targetModel = mapToActualAnthropicModel(model);
      console.log(`Anthropic Pipeline -> Wywo\u0142uj\u0119 model: ${model} (target API: ${targetModel})`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6e4);
      const bodyPayload = {
        model: targetModel,
        max_tokens: max_tokens || 4096,
        messages: chatMessages,
        temperature: 0.7
      };
      if (sysInst) {
        bodyPayload.system = sysInst;
      }
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const content = data.content?.[0]?.text || "";
        return res.json({ text: content, modelUsed: model || targetModel });
      } else {
        const errText = await response.text();
        console.warn(`Anthropic error (${response.status}):`, errText);
        return res.status(response.status).json({ error: `Anthropic error: ${errText}` });
      }
    } catch (err) {
      console.error("Anthropic handler error:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  };
  const handleDeepSeek = async (req, res) => {
    try {
      const { prompt, systemInstruction, messages, model, isJson } = req.body || {};
      if (!prompt && !messages) return res.status(400).json({ error: "Missing prompt or messages" });
      const deepseekKey = getDeepSeekApiKey();
      if (!deepseekKey) {
        console.warn("[DeepSeek] Brak DEEPSEEK_API_KEY na serwerze.");
        return res.status(503).json({ error: "Brak skonfigurowanego klucza DeepSeek API (DEEPSEEK_API_KEY)." });
      }
      let sysInst = systemInstruction || "";
      if (isJson && !sysInst.toLowerCase().includes("json")) {
        sysInst = (sysInst ? sysInst + "\n\n" : "") + "Respond in valid JSON format.";
      }
      let chatMessages = [];
      if (sysInst) {
        chatMessages.push({ role: "system", content: sysInst });
      }
      if (Array.isArray(messages) && messages.length > 0) {
        for (const m of messages) {
          if (m && typeof m === "object" && m.content) {
            chatMessages.push({
              role: m.role === "system" || m.role === "assistant" || m.role === "user" ? m.role : "user",
              content: String(m.content)
            });
          }
        }
      } else {
        let userPrompt = String(prompt || "");
        if (isJson && !userPrompt.toLowerCase().includes("json")) {
          userPrompt += "\n\n(Output must be in valid JSON format)";
        }
        chatMessages.push({ role: "user", content: userPrompt || "Generate content" });
      }
      const targetModel = mapToActualDeepSeekModel(model);
      console.log(`DeepSeek Pipeline -> Wywo\u0142uj\u0119 model: ${model} (target API: ${targetModel})`);
      const bodyPayload = {
        model: targetModel,
        messages: chatMessages,
        temperature: targetModel === "deepseek-reasoner" ? void 0 : 0.7
      };
      if (isJson && targetModel !== "deepseek-reasoner") {
        bodyPayload.response_format = { type: "json_object" };
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6e4);
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekKey}`
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return res.json({ text: content, modelUsed: model || targetModel });
      } else {
        const errText = await response.text();
        console.warn(`DeepSeek error (${response.status}):`, errText);
        return res.status(response.status).json({ error: `DeepSeek error: ${errText}` });
      }
    } catch (err) {
      console.error("DeepSeek handler error:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  };
  const GEMINI_MODEL_PATTERN = /^gemini-[a-z0-9.\-]{1,60}$/i;
  app2.post("/api/gemini/generate", requireFirebaseAuth, async (req, res) => {
    try {
      const { model, contents, config } = req.body || {};
      if (typeof model !== "string" || !GEMINI_MODEL_PATTERN.test(model)) {
        return res.status(400).json({ error: "Nieprawid\u0142owa nazwa modelu." });
      }
      if (contents === void 0 || contents === null) {
        return res.status(400).json({ error: "Brak pola contents." });
      }
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        console.warn("[Gemini] Brak GEMINI_API_KEY na serwerze.");
        return res.status(503).json({ error: "Us\u0142uga AI jest chwilowo niedost\u0119pna." });
      }
      const modelsToTry = Array.from(/* @__PURE__ */ new Set([
        model,
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3.7-flash"
      ]));
      let lastErr;
      for (const m of modelsToTry) {
        let retries = 2;
        while (retries > 0) {
          try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({ model: m, contents, config });
            return res.json({
              text: response?.text ?? "",
              candidates: response?.candidates ?? [],
              modelUsed: m
            });
          } catch (err) {
            lastErr = err;
            const errMsg = err?.message || String(err);
            const status = Number(err?.status);
            console.warn(`[Gemini Proxy] Model ${m} failed (status ${status || "unknown"}, retries left ${retries - 1}):`, errMsg);
            const isRetryable = status === 503 || status === 429 || errMsg.includes("503") || errMsg.includes("429") || errMsg.toLowerCase().includes("demand") || errMsg.toLowerCase().includes("unavailable");
            if (isRetryable) {
              retries--;
              if (retries > 0) {
                await new Promise((r) => setTimeout(r, 1200));
                continue;
              }
            }
            break;
          }
        }
      }
      throw lastErr;
    } catch (err) {
      console.error("[Gemini] proxy error:", err?.message || err);
      const status = Number(err?.status);
      return res.status(status >= 400 && status < 600 ? status : 503).json({ error: formatErrorString(err) });
    }
  });
  app2.post("/api/openai", requireFirebaseAuth, handleOpenAI);
  app2.post("/api/openai/generate", requireFirebaseAuth, handleOpenAI);
  app2.post("/api/anthropic", requireFirebaseAuth, handleAnthropic);
  app2.post("/api/anthropic/generate", requireFirebaseAuth, handleAnthropic);
  app2.post("/api/deepseek", requireFirebaseAuth, handleDeepSeek);
  app2.post("/api/deepseek/generate", requireFirebaseAuth, handleDeepSeek);
  app2.use("/api", (req, res) => {
    res.status(404).json({ error: `Nie odnaleziono endpointu API: ${req.method} ${req.originalUrl || req.path}` });
  });
  return app2;
}
async function startServer() {
  const app2 = await createApp();
  const PORT = Number(process.env.PORT) || 3e3;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
    const handleDevHtml = async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite?.ssrFixStacktrace(e);
        next(e);
      }
    };
    app2.get("/", handleDevHtml);
    app2.get("{*all}", handleDevHtml);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app2.use(express.static(distPath));
    app2.get("/", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app2.get("{*all}", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  const server = app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      const altPort = PORT + 1;
      console.warn(`[Server] Port ${PORT} busy, starting on http://localhost:${altPort}`);
      app2.listen(altPort, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${altPort}`);
      });
    } else {
      console.error("[Server] Startup error:", err);
    }
  });
}
var isDirectExecution = !process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME && typeof process.argv[1] === "string" && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.cjs"));
if (isDirectExecution) {
  startServer().catch(console.error);
}

// api/serverless.ts
var maxDuration = 60;
var app = createApp();
function handler(req, res) {
  try {
    if (req.url) {
      const match = req.url.match(/[?&]__url=([^&]+)/);
      if (match) {
        req.url = decodeURIComponent(match[1]);
      } else {
        const originalPath = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"] || req.headers["x-original-url"];
        if (originalPath && typeof originalPath === "string" && originalPath.startsWith("/api")) {
          req.url = originalPath;
        }
      }
    }
    app(req, res);
  } catch (err) {
    console.error("[API Gateway Crash]:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "API Gateway Crash",
        message: err?.message || String(err),
        stack: err?.stack || ""
      });
    }
  }
}
export {
  handler as default,
  maxDuration
};
