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

// server.ts
var import_firebase_applet_config = __toESM(require_firebase_applet_config(), 1);
import express from "express";
import path from "path";
import fs from "fs";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createHmac } from "crypto";
import { GoogleGenAI, Type } from "@google/genai";

// services/aiModels.ts
var PRIMARY_MODEL = "openai/gpt-5.6-luna";
var SECONDARY_MODEL = "gemini-3.8-flash";
var TERTIARY_MODEL = "openai/gpt-4o-mini";
var AI_MODEL_CASCADE = [
  PRIMARY_MODEL,
  SECONDARY_MODEL,
  TERTIARY_MODEL,
  "gemini-2.5-flash"
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
var asText = (value) => typeof value === "string" ? value : value == null ? "" : String(value);
function normalizeLessonDate(value, today) {
  const text = asText(value).trim();
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
    studentId: asText(lesson.studentId) || fallbackStudentId,
    studentIds: Array.isArray(lesson.studentIds) ? lesson.studentIds.map(asText).filter(Boolean) : [],
    lessonTopic: asText(lesson.lessonTopic).trim(),
    revisionNotes: asText(lesson.revisionNotes),
    vocabularyText: asText(lesson.vocabularyText),
    studentSpeaking: asText(lesson.studentSpeaking),
    thingsToImprove: asText(lesson.thingsToImprove),
    suggestedFollowUp: asText(lesson.suggestedFollowUp)
  })).filter(
    (lesson) => lesson.lessonTopic || lesson.revisionNotes.trim() || lesson.vocabularyText.trim()
  );
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

// server.ts
function mapToActualOpenAIModel(modelName) {
  const clean = String(modelName || "").replace(/^openai\//, "").trim().toLowerCase();
  if (clean === "gpt-5.6-luna" || clean === "gpt-5.6" || clean.includes("luna")) {
    return "gpt-4o";
  }
  if (clean.includes("gpt-4o-mini")) return "gpt-4o-mini";
  if (clean.includes("gpt-4o")) return "gpt-4o";
  if (clean.includes("gpt-4-turbo")) return "gpt-4-turbo";
  if (clean.includes("gpt-4")) return "gpt-4";
  if (clean.includes("gpt-3.5-turbo") || clean.includes("gpt-3.5")) return "gpt-3.5-turbo";
  return "gpt-4o-mini";
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
          const targetModel = mapToActualOpenAIModel(model);
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
  if (getApps().length > 0) return getApp();
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    try {
      const parsed = JSON.parse(serviceAccountStr);
      return initializeApp({ credential: cert(parsed) });
    } catch {
      console.warn("[Firebase Admin] Failed to parse service account");
    }
  }
  const projectId = getAdminProjectId();
  if (projectId) {
    console.warn(
      `[Firebase Admin] Brak FIREBASE_SERVICE_ACCOUNT \u2014 weryfikuj\u0119 tokeny samym ID projektu (${projectId}). Wystarczy do ochrony tras /api; operacje wymagaj\u0105ce uprawnie\u0144 administratora b\u0119d\u0105 niedost\u0119pne.`
    );
    return initializeApp({ projectId });
  }
  console.error("[Firebase Admin] Brak konta us\u0142ugi i ID projektu \u2014 trasy /api b\u0119d\u0105 odrzuca\u0107 wszystkie \u017C\u0105dania.");
  return initializeApp();
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
      const ADMIN_EMAILS = ["maciej.wyrozumski@gmail.com", "marta.lukaszczyk@gmail.com"];
      const email = (decodedToken.email || "").toLowerCase();
      const isAdminByEmail = ADMIN_EMAILS.includes(email);
      const isAdminByClaim = decodedToken.role === "admin" || decodedToken.admin === true || decodedToken.role === "teacher";
      if (!isAdminByEmail && !isAdminByClaim) {
        try {
          const adminApp2 = getAdminApp();
          const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
      const { email, password, role } = req.body;
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email,
          password
        });
      } catch (authError) {
        if (authError.code === "auth/email-already-exists") {
          userRecord = await adminAuth.getUserByEmail(email);
          await adminAuth.updateUser(userRecord.uid, { password });
        } else {
          throw authError;
        }
      }
      if (role) {
        await adminAuth.setCustomUserClaims(userRecord.uid, { role });
      }
      res.json(userRecord);
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
        const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
  const FIRESTORE_DATABASE_ID = "ai-studio-520a4841-33d0-41ef-829a-838ebc44072d";
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
      const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
      const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
      const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
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
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
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
  app2.post("/api/mailing/test-send", requireFirebaseAdmin, async (req, res) => {
    try {
      const { to, from: clientFrom, subject, html, text, apiKey: clientApiKey, replyTo, bcc: clientBcc } = req.body;
      if (!to || typeof to !== "string" || !to.includes("@")) {
        return res.status(400).json({ error: "Wymagany jest poprawny adres e-mail odbiorcy." });
      }
      let apiKey = typeof clientApiKey === "string" && clientApiKey.trim() || process.env.RESEND_API_KEY;
      if (!apiKey && adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
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
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
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
      const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
      const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
      const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
      const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
      const adminDb = getFirestore(adminApp2, FIRESTORE_DATABASE_ID);
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
      const typeRulesMap = {
        "translation": "- translation: 1 zadanie zbiorcze. W 'prompt' umie\u015B\u0107 N zda\u0144 polskich w punktach (1., 2., ...). Dodaj w nawiasie kr\xF3tk\u0105 wskaz\xF3wk\u0119, np. (past simple), aby kursant wiedzia\u0142 co zastosowa\u0107. W 'correctAnswer' umie\u015B\u0107 N angielskich t\u0142umacze\u0144 w punktach (1., 2., ...).",
        "fill_in_blank": "- fill_in_blank: 1 zadanie zbiorcze w formie JEDNEGO SP\xD3JNEGO TEKSTU (np. kr\xF3tka historyjka, opowiadanie). W 'prompt' umie\u015B\u0107 tekst z lukami '___', oznaczonymi numerami lub po prostu w tek\u015Bcie. W 'correctAnswer' umie\u015B\u0107 N poprawnych s\u0142\xF3w w punktach (1., 2., ...).",
        "fill_in_blank_bank": "- fill_in_blank_bank: 1 zadanie zbiorcze w formie JEDNEGO SP\xD3JNEGO TEKSTU (np. kr\xF3tka historyjka). W 'wordBank' umie\u015B\u0107 s\u0142owa w rozsypce do wstawienia. W 'prompt' umie\u015B\u0107 tekst z lukami '___'. W 'correctAnswer' umie\u015B\u0107 N odpowiedzi. KOLEJNO\u015A\u0106 S\u0141\xD3W W 'wordBank' MUSI BY\u0106 LOSOWA I R\xD3\u017BNA OD KOLEJNO\u015ACI LUK W TEK\u015ACIE \u2014 s\u0142owo do pierwszej luki nie mo\u017Ce by\u0107 pierwsze na li\u015Bcie. Rozsypka u\u0142o\u017Cona po kolei zamienia \u0107wiczenie w przepisywanie.",
        "matching": `- matching: 1 zadanie zbiorcze. W 'options' zamie\u015B\u0107 list\u0119 wszystkich N par w formacie ["s\u0142owo1 = word1", "s\u0142owo2 = word2", ...].`,
        "find_mistake": "- find_mistake: 1 zadanie zbiorcze polegaj\u0105ce na korekcie b\u0142\u0119d\xF3w w zdaniach. W 'prompt' umie\u015B\u0107 N zda\u0144 w j\u0119zyku angielskim zawieraj\u0105cych celowe b\u0142\u0119dy w punktach (1., 2., ...). RODZAJE B\u0141\u0118D\xD3W DO WYMIESZANIA: gramatyczne, leksykalne, przyimkowe ORAZ OBOWI\u0104ZKOWO B\u0141\u0118DNY SZYK ZDANIA (wrong syntax / word order) \u2014 co najmniej jedno zdanie na zestaw musi mie\u0107 przestawiony szyk, np. \u017Ale umiejscowiony okolicznik czasu, przys\u0142\xF3wek cz\u0119stotliwo\u015Bci w z\u0142ym miejscu albo szyk pytaj\u0105cy w zdaniu twierdz\u0105cym. Do KA\u017BDEGO zdania z b\u0142\u0119dem OBOWI\u0104ZKOWO dodaj na ko\u0144cu w nawiasie zwi\u0119z\u0142\u0105 wskaz\xF3wk\u0119 naprowadzaj\u0105c\u0105 w formacie: (wskaz\xF3wka: tre\u015B\u0107 wskaz\xF3wki), np. (wskaz\xF3wka: z\u0142y przyimek), (wskaz\xF3wka: 3. osoba l. pojedynczej), (wskaz\xF3wka: z\u0142y szyk zdania). W 'correctAnswer' umie\u015B\u0107 N w pe\u0142ni poprawnych zda\u0144 w punktach (1., 2., ...). Nie wype\u0142niaj pola options dla tego typu.",
        "multiple_choice": "- multiple_choice: 1 zadanie zbiorcze. W 'prompt' umie\u015B\u0107 JEDEN SP\xD3JNY TEKST z lukami '___', albo N pyta\u0144 wielokrotnego wyboru, w zale\u017Cno\u015Bci od kontekstu. Je\u015Bli to test z gramatyki np. czasowniki, to kr\xF3tka historyjka jest preferowana. Podaj opcje A/B/C. ROZ\u0141\xD3\u017B POPRAWNE ODPOWIEDZI R\xD3WNOMIERNIE MI\u0118DZY POZYCJE A, B i C \u2014 poprawna odpowied\u017A nie mo\u017Ce stale wypada\u0107 jako pierwsza, bo kursant rozwi\u0105\u017Ce zadanie bez czytania opcji.",
        "writing": "- writing: 1 zadanie z d\u0142u\u017Csz\u0105 wypowiedzi\u0105 pisemn\u0105."
      };
      const activeTypes = selectedTypes || ["multiple_choice", "fill_in_blank", "fill_in_blank_bank", "translation"];
      const activeRules = activeTypes.map((t) => typeRulesMap[t]).filter(Boolean).join("\n   ");
      let contents = [];
      const prompt = `Jeste\u015B asystentem edukacyjnym, generatorem test\xF3w opartym o zaawansowany model.
Twoim zadaniem jest przygotowanie wysoce spersonalizowanego testu dla kursanta, analizuj\u0105c jego histori\u0119 lekcji.

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
      const parseQuestions = (raw) => {
        if (!raw) return null;
        try {
          const cleaned = raw.replace(/^```json\n?/g, "").replace(/```$/g, "").trim();
          const value = JSON.parse(cleaned);
          return Array.isArray(value) && value.length > 0 ? value : null;
        } catch {
          return null;
        }
      };
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
  app2.post("/api/gemini/lesson-summary", requireFirebaseAdmin, async (req, res) => {
    try {
      const { notes, pdfBase64, driveFile, students } = req.body;
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

Powy\u017Cej znajduje si\u0119 plik PDF z notatkami z lekcji. Przeanalizuj go.` }
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

Powy\u017Cej znajduje si\u0119 plik PDF z notatkami z lekcji. Przeanalizuj go.` }
          ]
        }];
      } else {
        promptContext = [{
          role: "user",
          parts: [{ text: `Baza kursant\xF3w:
${studentsListStr}

Transkrypcja/Notatki ze spotkania:
${notes}` }]
        }];
      }
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
          suggestedFollowUp: { type: Type.STRING }
        },
        required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText", "studentSpeaking", "thingsToImprove", "suggestedFollowUp"]
      };
      let response = await generateContentWithRetry(ai, promptContext, {
        systemInstruction: sysInstruction,
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
          const actualApiTarget = mapToActualOpenAIModel(modelName);
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
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app2.use(express.static(distPath));
    app2.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
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
