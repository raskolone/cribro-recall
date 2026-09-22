
function mapToActualOpenAIModel(modelName: string): string {
  const clean = String(modelName || '').replace(/^openai\//, '').trim().toLowerCase();
  if (clean === 'gpt-5.6-luna' || clean === 'gpt-5.6' || clean.includes('luna')) {
    // GPT 5.6 Luna represents the flagship OpenAI intelligence tier - map to latest flagship endpoint
    return 'gpt-4o';
  }
  if (clean.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (clean.includes('gpt-4o')) return 'gpt-4o';
  if (clean.includes('o3-mini')) return 'o3-mini';
  if (clean.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (clean.includes('gpt-4')) return 'gpt-4';
  if (clean.includes('gpt-3.5-turbo') || clean.includes('gpt-3.5')) return 'gpt-3.5-turbo';
  return 'gpt-4o-mini';
}

function mapToActualAnthropicModel(modelName: string): string {
  const clean = String(modelName || '').replace(/^anthropic\//, '').trim().toLowerCase();
  if (clean.includes('3-7') || clean.includes('3.7')) return 'claude-3-7-sonnet-20250219';
  if (clean.includes('3-5-haiku') || clean.includes('3.5-haiku') || clean.includes('haiku')) return 'claude-3-5-haiku-20241022';
  if (clean.includes('3-5-sonnet') || clean.includes('3.5-sonnet') || clean.includes('sonnet')) return 'claude-3-5-sonnet-20241022';
  return 'claude-3-7-sonnet-20250219';
}

function mapToActualDeepSeekModel(modelName: string): string {
  const clean = String(modelName || '').replace(/^deepseek\//, '').trim().toLowerCase();
  if (clean.includes('reasoner') || clean.includes('r1')) return 'deepseek-reasoner';
  return 'deepseek-chat';
}

function extractJsonFromString(str: string): any {
  if (!str || typeof str !== "string") return null;
  const start = str.indexOf('{');
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
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(str.slice(start, i + 1));
            if (parsed && typeof parsed === "object") return parsed;
          } catch {}
        }
      }
    }
  }
  return null;
}

function formatErrorString(err: any): string {
  if (!err) return "Wystąpił nieznany błąd";
  if (typeof err === "string") {
    const parsed = extractJsonFromString(err);
    if (parsed) {
      return formatErrorString(parsed);
    }
    if (err.includes("All models failed")) {
      const lines = err.split('\n').filter(l => l.trim() && !l.startsWith('Details:') && !l.startsWith('All models failed'));
      if (lines.length > 0) {
        return lines.map(l => formatErrorString(l.replace(/^\[[^\]]+\]\s*/, ''))).join("; ");
      }
    }
    return err.trim() || "Wystąpił błąd";
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
      const msgs = err.errors.map((e: any) => typeof e === "object" ? (e.message || formatErrorString(e)) : String(e)).filter(Boolean);
      if (msgs.length > 0) return msgs.join(", ");
    } else if (typeof err.errors === "string") {
      return err.errors.trim();
    } else if (typeof err.errors === "object") {
      return formatErrorString(err.errors);
    }
  }
  if (Array.isArray(err)) {
    const msgs = err.map((e: any) => typeof e === "object" ? (e.message || formatErrorString(e)) : String(e)).filter(Boolean);
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

async function callOpenAIServerFallback(prompt, system, schema) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      console.log("[Server] Attempting OpenAI GPT model...");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system || "You are a helpful assistant." },
            { role: "user", content: prompt }
          ],
          response_format: schema ? { type: "json_object" } : { type: "text" },
          temperature: 0.7
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      } else {
        console.warn("[Server] OpenAI request failed:", await res.text());
      }
    } catch(e) {
      console.warn("[Server] OpenAI error:", e);
    }
  }
  return null;
}

import { extractListFromModelJson } from "./utils/modelJsonList";
import {
  LANGUAGE_IRON_RULE,
  describeProblems,
  rulesForTypes,
  validateTestLanguage,
} from "./utils/testExerciseRules";
import express from "express";
import path from "path";
import fs from "fs";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createHmac } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GoogleGenAI, Type } from "@google/genai";
import defaultFirebaseConfig from "./firebase-applet-config.json";
import { AI_MODEL_CASCADE, GEMINI_MODEL_CASCADE, openAiModelsFor, PRIMARY_MODEL } from "./services/aiModels";
import { normalizeImportedLessons } from "./utils/lessonImport";
import { normalizeStudentImportAnalysis } from "./utils/studentImportNormalize";
import {
  ScenarioDurationMin,
  LessonScenario,
} from "./types/scenario";
import { generateScenarioForStudent } from "./services/scenarioAiService";
import { ScenarioContextError } from "./services/scenarioContextService";
import { resolveStudentRef, StudentResolutionError } from "./services/studentResolver";
import { ScenarioCanvasV2 } from "./types/scenarioCanvas";
import { generateScenarioCanvasForStudent, refreshScenarioCanvasBlocks } from "./services/scenarioCanvasAiService";
import { getRejectedItemIds } from "./utils/scenarioCanvasValidation";
import { shuffleDistinct } from "./utils/exerciseShuffle";
import { assembleContext } from "./functions/src/homeworkV2/contextAssembler";
import { planExercises } from "./functions/src/homeworkV2/exercisePlanner";
import { buildExerciseSet } from "./functions/src/homeworkV2/pipeline";
import { createAiCall } from "./functions/src/homeworkV2/openai";
import { isHomeworkEngineV2Enabled, ENGINE_DISABLED_MESSAGE } from "./functions/src/homeworkV2/flag";
import { getRecentMistakes } from "./functions/src/homeworkV2/learningProfile";
import { SCHEMA_VERSION } from "./functions/src/homeworkV2/contracts";
import { buildV2TaskPayload, newHomeworkSetId, selectSendableExercises } from "./functions/src/homeworkV2/assignment";
import { buildGradedHomeworkEmail } from "./services/homeworkEmail";
import {
  ingestAttempts,
  serializeLearningProfile,
  createProfile,
  normalizeLevel,
  deserializeLearningProfile
} from "./utils/learningCurve";
import { fetchNotionBlocksText } from "./utils/notionBlocksFetcher";
import { isJunkIsoTopic, formatLessonDateDDMMYYYY } from "./utils/lessonDisplay";
let pdfParse: any;
try {
  const loadedPdf = typeof require !== "undefined" ? require("pdf-parse") : null;
  if (loadedPdf) {
    pdfParse = typeof loadedPdf === "function" ? loadedPdf : (loadedPdf.default || loadedPdf);
  }
} catch (e) {
  console.warn("Failed to load pdf-parse:", e);
}

async function generateContentWithRetry(aiClient: any, contents: any, config: any, customModels?: string[]) {
  const models = customModels || AI_MODEL_CASCADE;
  let lastError;
  const errors: string[] = [];
  
  for (const model of models) {
    let retries = 2;
    while (retries > 0) {
      try {
        console.log(`[Server] Attempting generation with ${model}... (retries left: ${retries})`);
        
        let promptText = "";
        if (typeof contents === 'string') {
          promptText = contents;
        } else if (Array.isArray(contents)) {
          promptText = contents.map((c: any) => {
            if (typeof c === 'string') return c;
            if (c.text) return c.text;
            if (c.parts && Array.isArray(c.parts)) {
              return c.parts.map((p: any) => (typeof p === 'string' ? p : p.text || '')).join('\n');
            }
            if (c.inlineData) return "[Załączono plik, który nie może być bezpośrednio przetworzony jako tekst]";
            return typeof c === 'object' ? JSON.stringify(c) : String(c);
          }).filter(Boolean).join('\n');
        } else if (contents && contents.parts && Array.isArray(contents.parts)) {
          promptText = contents.parts.map((p: any) => {
            if (typeof p === 'string') return p;
            if (p.text) return p.text;
            if (p.inlineData) return "[Załączono plik, który nie może być bezpośrednio przetworzony jako tekst]";
            return typeof p === 'object' ? JSON.stringify(p) : String(p);
          }).filter(Boolean).join('\n');
        } else if (contents && typeof contents === 'object' && contents.text) {
          promptText = contents.text;
        } else {
          promptText = JSON.stringify(contents);
        }

        let sysInst = config?.systemInstruction || "";

        if (model.startsWith('openai')) {
           const apiKey = getOpenAIApiKey();
           if (!apiKey) {
             console.warn("[Server] OPENAI_API_KEY not configured, skipping model");
             throw new Error("OPENAI_API_KEY not configured");
           }
           
           const targetModel = mapToActualOpenAIModel(model);
           const isJsonMode = config?.responseMimeType === 'application/json';

           let finalPrompt = promptText;
           if (isJsonMode) {
             if (!sysInst.toLowerCase().includes('json')) {
               sysInst = (sysInst ? sysInst + "\n\n" : "") + "Respond in valid JSON format.";
             }
             if (!finalPrompt.toLowerCase().includes('json')) {
               finalPrompt += '\n\nReturn output in valid JSON format.';
             }
           }

           const bodyPayload: any = {
             model: targetModel,
             messages: [
               ...(sysInst ? [{ role: "system", content: sysInst }] : []),
               { role: "user", content: finalPrompt || "Generate content" }
             ],
             temperature: config?.temperature !== undefined ? config.temperature : 0.7
           };

           if (isJsonMode) {
             bodyPayload.response_format = { type: "json_object" };
           }

           const controller = new AbortController();
           const timeoutId = setTimeout(() => controller.abort(), 60000);

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
             const errObj: any = new Error(`OpenAI API error (${response.status}): ${errText}`);
             errObj.status = response.status;
             throw errObj;
           }
           const data = await response.json();
           return { text: data.choices?.[0]?.message?.content || "" };

        } else {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Request timed out after 60 seconds")), 60000);
            });
            
            const apiCall = aiClient.models.generateContent({
              model,
              contents,
              config
            });
            
            const response = await Promise.race([apiCall, timeoutPromise]);
            return response;
        }
      } catch (err: any) {
        const errorMsg = err?.status ? `${err.status} - ${err.message}` : err?.message || String(err);
        errors.push(`[${model}] ${errorMsg}`);
        console.warn(`[Server] Model ${model} failed:`, errorMsg);
        lastError = err;
        
        if (err?.message?.includes("timed out")) {
          break; // Next model immediately on timeout
        } else if (String(err?.status) === "429" || err?.message?.toLowerCase().includes("quota") || err?.message?.includes("429") || err?.message?.toLowerCase().includes("too many requests")) {
          console.warn("[Server] Quota exceeded, switching model immediately");
          break; // Next model immediately
        } else if (String(err?.status) === "503" || err?.message?.includes("503")) {
          retries--;
          if (retries > 0) {
            console.log(`[Server] Waiting before retry...`);
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
        } else {
          break; // Try next model on other errors
        }
      }
    }
  }
  
  throw new Error(`All models failed.\nDetails:\n${errors.join('\n')}`);
}


// Wait, I need VITE_FIREBASE_CONFIG for the project ID.
// Wait, process.env is available here but VITE_ variables are loaded by Vite.
// However `dot-env` or manually parsing process.env.VITE_FIREBASE_CONFIG.
// For now, I'll export an async function startServer()

// We can just rely on process.env.FIREBASE_SERVICE_ACCOUNT and initialize Firebase Admin
function getGeminiApiKey(): string {
  // Świadomie bez VITE_GEMINI_API_KEY: zmienna z tym przedrostkiem trafia
  // przy budowaniu do bundla przeglądarki, więc nie wolno jej używać do
  // niczego płatnego.
  return process.env.GEMINI_API_KEY || process.env.API_KEY || "";
}

function getOpenAIApiKey(): string {
  return process.env.OPENAI_API_KEY || "";
}

function getAnthropicApiKey(): string {
  return process.env.ANTHROPIC_API_KEY || "";
}

function getDeepSeekApiKey(): string {
  return process.env.DEEPSEEK_API_KEY || "";
}



/**
 * ID projektu Firebase dla weryfikacji tokenów.
 *
 * verifyIdToken sprawdza podpis publicznymi certyfikatami Google i porównuje
 * pole `aud` z ID projektu — klucz prywatny nie jest do tego potrzebny.
 * Dlatego ochrona tras /api działa także tam, gdzie nie wgrano konta usługi:
 * ID projektu leży w firebase-applet-config.json, który i tak jest publiczny.
 */
function getAdminProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const parsed = JSON.parse(process.env.VITE_FIREBASE_CONFIG || "{}");
    if (parsed?.projectId) return parsed.projectId;
  } catch {}
  return (defaultFirebaseConfig as any)?.projectId || "";
}

function getAdminApp() {
  if (getApps().length > 0) return getApp();
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    try {
      const parsed = JSON.parse(serviceAccountStr);
      return initializeApp({ credential: cert(parsed) });
    } catch {
      console.warn('[Firebase Admin] Failed to parse service account');
    }
  }

  const projectId = getAdminProjectId();
  if (projectId) {
    console.warn(
      `[Firebase Admin] Brak FIREBASE_SERVICE_ACCOUNT — weryfikuję tokeny samym ID projektu (${projectId}). ` +
      `Wystarczy do ochrony tras /api; operacje wymagające uprawnień administratora będą niedostępne.`
    );
    return initializeApp({ projectId });
  }

  console.error('[Firebase Admin] Brak konta usługi i ID projektu — trasy /api będą odrzucać wszystkie żądania.');
  return initializeApp(); // App Default Credentials
}

export function createApp() {
  const app = express();

  // Przywróć oryginalną ścieżkę żądania, jeśli router Vercela przepisał ją na /api
  app.use((req, res, next) => {
    const forwardPath = (req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-original-url']) as string;
    if (forwardPath && forwardPath.startsWith('/api') && (req.url === '/api' || req.url === '/api/' || req.url.startsWith('/api?'))) {
      req.url = forwardPath;
    }
    next();
  });
  
  app.use(express.json({ limit: '50mb' }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Payload too large' });
    }
    next(err);
  });

  const adminApp = getAdminApp();
  const adminAuth = getAuth(adminApp);

  /*
   * Nazwa bazy Firestore. Stoi TUTAJ, a nie niżej przy sekretach mailingu,
   * bo wczytanie kluczy AI zaraz pod spodem odpala się przy starcie procesu —
   * czyli zanim wykonają się deklaracje z dalszej części `createApp`.
   * Przy poprzednim położeniu każdy start kończył się wyjątkiem
   * „Cannot access 'FIRESTORE_DATABASE_ID' before initialization", złapanym
   * przez `catch` i zameldowanym jako „nie udało się wczytać kluczy z bazy" —
   * więc klucze zapisane w ustawieniach NIGDY nie wracały po restarcie,
   * a komunikat kazał szukać przyczyny w bazie.
   *
   * Pozostałe użycia są w obsłudze żądań, czyli po zakończeniu `createApp`,
   * i działały niezależnie od tego błędu.
   */
  const FIRESTORE_DATABASE_ID = 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d';

  /*
   * ══ KLUCZE ZAPISANE W APLIKACJI WRACAJĄ PO RESTARCIE ══
   *
   * Klucz podany w ustawieniach ląduje w `process.env` procesu ORAZ w bazie.
   * Bez tego odczytu przy starcie zmienna znikałaby przy każdym wdrożeniu
   * i restarcie, a administrator miałby „klucz zapisany" w interfejsie
   * i niedziałające generowanie w aplikacji.
   *
   * Zmienna środowiskowa WYGRYWA z zapisem w bazie: jeżeli ktoś ustawił klucz
   * we wdrożeniu, to jest decyzja świadoma i nie może jej cicho nadpisać wpis
   * sprzed miesiąca.
   */
  if (adminApp) {
    (async () => {
      try {
        const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
        const snap = await adminDb.collection('system').doc('ai').get();
        const keys = (snap.exists ? snap.data()?.keys : null) || {};
        const mapping: Record<string, string> = {
          openai: 'OPENAI_API_KEY',
          gemini: 'GEMINI_API_KEY',
          elevenlabs: 'ELEVENLABS_API_KEY',
        };
        for (const [provider, envName] of Object.entries(mapping)) {
          const stored = String(keys[provider] || '').trim();
          if (stored) {
            process.env[envName] = stored;
            console.log(`[AI] Klucz ${provider} wczytany z ustawień aplikacji (${maskKey(stored)}).`);
          }
        }
      } catch (e) {
        console.warn('[AI] Nie udało się wczytać kluczy z bazy:', e);
      }
    })();
  }

  // Authentication Middlewares
  async function optionalFirebaseAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.slice(7).trim();
      if (idToken && idToken !== 'null' && idToken !== 'undefined') {
        try {
          const decodedToken = await adminAuth.verifyIdToken(idToken);
          (req as any).userUid = decodedToken.uid;
          (req as any).userEmail = decodedToken.email;
        } catch (err: any) {
          console.warn('Optional auth token verification failed:', err.message);
        }
      }
    }
    next();
  }

  async function requireFirebaseAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }
    
    const idToken = authHeader.slice(7).trim();
    if (!idToken || idToken === 'null' || idToken === 'undefined') {
      res.status(401).json({ error: 'Missing or empty Bearer token' });
      return;
    }
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      (req as any).userUid = decodedToken.uid;
      (req as any).userEmail = decodedToken.email;
      next();
    } catch (err: any) {
      console.warn('Auth token verification failed:', err.message);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  async function requireFirebaseAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }
    
    const idToken = authHeader.slice(7).trim();
    if (!idToken || idToken === 'null' || idToken === 'undefined') {
      res.status(401).json({ error: 'Missing or empty Bearer token' });
      return;
    }
    try {
      // Very simple admin check: decode token using Admin SDK (easier than manually parsing with JWKS here)
      // Actually, if we use Admin SDK, we don't strictly *need* JWKS, adminAuth.verifyIdToken does exactly that securely.
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      
      // Admin emails & claims
      const ADMIN_EMAILS = [
        'maciej.wyrozumski@gmail.com',
        'marta.lukaszczyk@gmail.com',
        'maciejwyrozumski@icloud.com',
        'wyrozumski@maciej.pro',
        'maciej@learnwithmaciej.com',
      ];
      const email = (decodedToken.email || '').toLowerCase();
      const isAdminByEmail = ADMIN_EMAILS.includes(email);
      const isAdminByClaim = decodedToken.role === 'admin' || decodedToken.admin === true || decodedToken.role === 'teacher';
      
      if (!isAdminByEmail && !isAdminByClaim) {
        try {
          const adminApp = getAdminApp();
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
          const role = userDoc.data()?.role;
          if (role !== 'admin' && role !== 'teacher') {
            res.status(403).json({ error: 'Forbidden: Admin access required' });
            return;
          }
        } catch {
          if (!isAdminByEmail) {
            res.status(403).json({ error: 'Forbidden: Admin access required' });
            return;
          }
        }
      }
      
      (req as any).adminUid = decodedToken.uid;
      next();
    } catch (err: any) {
      console.warn('Admin Auth token verification failed:', err.message);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Admin API Endpoints
  app.get('/api/admin-users/users', requireFirebaseAdmin, async (req, res) => {
    try {
      const listUsersResult = await adminAuth.listUsers(1000);
      res.json(listUsersResult.users);
    } catch (error: any) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  app.post('/api/admin-users/users', requireFirebaseAdmin, async (req, res) => {
    try {
      const { email, password, role, username, displayName, firstName, lastName, ...extraData } = req.body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      
      const resolvedDisplayName = displayName || username || (firstName && lastName ? `${firstName} ${lastName}`.trim() : cleanEmail.split('@')[0]);
      const nameParts = (resolvedDisplayName || '').split(' ');
      const resolvedFirst = firstName || (nameParts[0] || resolvedDisplayName);
      const resolvedLast = lastName || (nameParts.slice(1).join(' ') || '');
      const cleanUsername = username || resolvedDisplayName;

      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email: cleanEmail,
          password,
          displayName: resolvedDisplayName,
        });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          userRecord = await adminAuth.getUserByEmail(cleanEmail);
          if (password) {
            await adminAuth.updateUser(userRecord.uid, { password });
          }
        } else {
          throw authError;
        }
      }
      
      // Optionally set custom claims for role here
      if (role) {
        await adminAuth.setCustomUserClaims(userRecord.uid, { role });
      }

      // Atomowy zapis profilu w Firestore przez Admin SDK (omija ograniczenia reguł klienta)
      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      const newUserDoc: Record<string, any> = {
        email: cleanEmail,
        username: cleanUsername,
        displayName: resolvedDisplayName,
        firstName: resolvedFirst,
        lastName: resolvedLast,
        role: role || 'user',
        createdAt: new Date().toISOString(),
        loginCount: 0,
        streakCount: 0,
        requirePasswordChange: true,
        tempPassword: password,
        statusWspolpracy: 'Aktywny',
        ...extraData,
      };

      await adminDb.collection('users').doc(userRecord.uid).set(newUserDoc, { merge: true });

      res.json({
        ...userRecord,
        uid: userRecord.uid,
        email: cleanEmail,
        userDoc: newUserDoc,
      });
    } catch (error: any) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  app.delete('/api/admin-users/users/:uid', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      await adminAuth.deleteUser(uid);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  app.post('/api/admin-users/users/:uid/password', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      const { password } = req.body;
      await adminAuth.updateUser(uid, { password });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  // Odrzucenie lekcji "Do potwierdzenia" (import z Notion) przez Admin SDK —
  // omija reguły klienckie Firestore, które przy odrzucaniu potrafiły rzucać
  // "Missing or insufficient permissions", jeśli konto lektora nie spełniało
  // warunku isAdmin() w firestore.rules (np. brak roli na koncie).
  app.post('/api/lessons/reject-pending', requireFirebaseAdmin, async (req, res) => {
    try {
      const { studentId, lessonId, vocabularySetId, notionPageId, topic, date, reason } = req.body;
      if (!studentId || !lessonId) {
        res.status(400).json({ error: 'studentId i lessonId są wymagane' });
        return;
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      const studentRef = adminDb.collection('users').doc(studentId);

      const deleteIfExists = async (ref: FirebaseFirestore.DocumentReference) => {
        const snap = await ref.get();
        if (snap.exists) await ref.delete();
      };

      await deleteIfExists(studentRef.collection('lessonRecords').doc(lessonId));
      if (vocabularySetId) {
        await deleteIfExists(studentRef.collection('vocabularySets').doc(vocabularySetId));
      }
      await deleteIfExists(adminDb.collection('sets').doc(`set-lesson-${lessonId}`));

      const rejectedId = notionPageId || lessonId;
      await studentRef.collection('rejectedNotionLessons').doc(rejectedId).set({
        id: rejectedId,
        studentId,
        topic: (topic || '').trim() || 'Lekcja bez tematu',
        date: date || '',
        rejectedAt: new Date().toISOString(),
        reason: reason || 'Odrzucono przez nauczyciela (manualny przegląd)',
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  app.post('/api/admin-users/users/:uid/role', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      const { role } = req.body;
      await adminAuth.setCustomUserClaims(uid, { role });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  app.post('/api/admin-users/users/:uid/email', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      const { email } = req.body;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Nieprawidłowy adres e-mail.' });
      }

      const trimmedEmail = email.trim().toLowerCase();

      // 1. Zaktualizuj e-mail w Firebase Auth
      try {
        await adminAuth.updateUser(uid, { email: trimmedEmail });
      } catch (authErr: any) {
        console.warn(`[Admin User Email] Auth update warning for ${uid}:`, authErr?.message);
        if (authErr?.code === 'auth/email-already-exists') {
          return res.status(400).json({ error: 'Ten adres e-mail jest już przypisany do innego konta w systemie.' });
        }
        if (authErr?.code === 'auth/invalid-email') {
          return res.status(400).json({ error: 'Podano nieprawidłowy format adresu e-mail.' });
        }
      }

      // 2. Zaktualizuj e-mail w profilu Firestore
      try {
        const adminApp = getAdminApp();
        const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
        await adminDb.collection('users').doc(uid).set({
          email: trimmedEmail,
        }, { merge: true });
      } catch (dbErr: any) {
        console.warn(`[Admin User Email] Firestore admin update warning for ${uid}:`, dbErr?.message);
      }

      res.json({ success: true, email: trimmedEmail });
    } catch (error: any) {
      console.error('[Admin User Email Error]:', error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  function normalizeUsername(username: string): string {
    return (username || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30) || 'student';
  }

  // Hurtowy import kursantów z poziomu Asystenta CRM (wyłącznie dla Administratora)
  app.post('/api/admin-users/bulk-import', requireFirebaseAdmin, async (req, res) => {
    try {
      const { students } = req.body;
      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ error: 'Brak listy kursantów do zaimportowania.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      const results: Array<{
        uid?: string;
        username: string;
        email: string;
        password?: string;
        status: 'created' | 'existing' | 'error';
        error?: string;
      }> = [];

      for (const item of students) {
        try {
          const rawFirst = String(item.firstName || '').trim();
          const rawLast = String(item.lastName || '').trim();
          const rawUsername = String(item.username || '').trim();

          let displayName = '';
          if (rawFirst || rawLast) {
            displayName = `${rawFirst} ${rawLast}`.trim();
          } else if (rawUsername) {
            displayName = rawUsername;
          } else {
            displayName = 'Kursant';
          }

          const cleanUsername = rawUsername || displayName;

          const rawEmail = String(item.email || '').trim().toLowerCase();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const finalEmail = (rawEmail && emailRegex.test(rawEmail))
            ? rawEmail
            : `${normalizeUsername(cleanUsername)}@student.vocabboost.com`;

          const rawPassword = String(item.password || '').trim();
          const finalPassword = rawPassword.length >= 6 ? rawPassword : Math.random().toString(36).slice(-8);

          let userRecord;
          let status: 'created' | 'existing' = 'created';

          try {
            userRecord = await adminAuth.createUser({
              email: finalEmail,
              password: finalPassword,
              displayName: displayName || cleanUsername,
            });
          } catch (authErr: any) {
            if (authErr?.code === 'auth/email-already-exists') {
              userRecord = await adminAuth.getUserByEmail(finalEmail);
              status = 'existing';
              if (rawPassword) {
                await adminAuth.updateUser(userRecord.uid, { password: finalPassword });
              }
            } else {
              throw authErr;
            }
          }

          const newUserDoc: Record<string, any> = {
            email: finalEmail,
            username: cleanUsername,
            displayName: displayName,
            firstName: rawFirst || (displayName.includes(' ') ? displayName.split(' ')[0] : displayName),
            lastName: rawLast || (displayName.includes(' ') ? displayName.split(' ').slice(1).join(' ') : ''),
            role: 'user',
            level: item.level || 'A2-B1',
            company: item.company || '',
            notes: item.notes || '',
            createdAt: new Date().toISOString(),
            loginCount: 0,
            streakCount: 0,
            requirePasswordChange: true,
            tempPassword: finalPassword,
            statusWspolpracy: 'Aktywny',
          };

          await adminDb.collection('users').doc(userRecord.uid).set(newUserDoc, { merge: true });

          results.push({
            uid: userRecord.uid,
            username: cleanUsername,
            email: finalEmail,
            password: finalPassword,
            status,
          });
        } catch (itemErr: any) {
          console.error('[Bulk Import Item Error]:', itemErr);
          results.push({
            username: item.username || item.firstName || 'Nieznany',
            email: item.email || '',
            status: 'error',
            error: formatErrorString(itemErr),
          });
        }
      }

      const createdCount = results.filter(r => r.status === 'created').length;
      const existingCount = results.filter(r => r.status === 'existing').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      res.json({
        total: students.length,
        created: createdCount,
        existing: existingCount,
        failed: errorCount,
        results,
      });
    } catch (error: any) {
      console.error('[Bulk Import Error]:', error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  // Web Scraping / Research Endpoint dla Asystenta
  app.post('/api/web-research/scrape', requireFirebaseAuth, async (req, res) => {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return res.status(400).json({ error: 'Nieprawidłowy adres URL. Wymagany protokół http:// lub https://' });
      }

      console.log(`[Web Scraping] Fetching URL: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 CRIBRO/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
          'Accept-Language': 'pl,en-US;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Strona odpowiedziała kodem ${response.status}: ${response.statusText}`,
        });
      }

      const html = await response.text();

      // Wyciągnij tytuł
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Strona WWW';

      // Usuń tagi techniczne i zbędne sekcje
      let cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ');

      // Zastąp nagłówki i bloki nowymi liniami
      cleaned = cleaned
        .replace(/<h[1-6][^>]*>/gi, '\n\n### ')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n\n')
        .replace(/<\/p>/gi, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n* ')
        .replace(/<\/li>/gi, '')
        .replace(/<tr[^>]*>/gi, '\n')
        .replace(/<td[^>]*>/gi, ' | ')
        .replace(/<th[^>]*>/gi, ' | ');

      // Usuń wszelkie pozostałe tagi HTML
      cleaned = cleaned.replace(/<[^>]+>/g, ' ');

      // Rozkoduj encje HTML
      cleaned = cleaned
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x2F;/g, '/');

      // Wyczyść nadmiarowe białe znaki
      const formattedText = cleaned
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 15000);

      res.json({
        url,
        title,
        textContent: formattedText,
        length: formattedText.length,
      });
    } catch (error: any) {
      console.error('[Web Scraping Error]:', error);
      res.status(500).json({ error: `Nie udało się pobrać strony: ${formatErrorString(error)}` });
    }
  });

  const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'cribro-recall-opt-out-secret-2026';

  const generateUnsubscribeToken = (uid: string): string => {
    return createHmac('sha256', UNSUBSCRIBE_SECRET).update(uid).digest('hex').slice(0, 16);
  };

  // Public 1-click unsubscribe endpoint (no login required, secured by HMAC token)
  app.post('/api/unsubscribe', async (req, res) => {
    try {
      const { uid, token, action } = req.body;
      if (!uid || typeof uid !== 'string') {
        return res.status(400).json({ error: 'Brak identyfikatora użytkownika.' });
      }

      const expectedToken = generateUnsubscribeToken(uid);
      if (!token || token !== expectedToken) {
        return res.status(403).json({ error: 'Nieprawidłowy lub wygasły token wypisania.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return res.status(404).json({ error: 'Konto kursanta nie zostało odnalezione.' });
      }

      const userData = userSnap.data() || {};
      const isReSubscribing = action === 'resubscribe';

      if (isReSubscribing) {
        await userRef.update({
          emailNotificationsDisabled: false,
          unsubscribedAt: null,
        });
        return res.json({
          ok: true,
          status: 'subscribed',
          email: userData.email,
          name: userData.firstName || userData.username || 'Kursancie',
        });
      }

      await userRef.update({
        emailNotificationsDisabled: true,
        unsubscribedAt: new Date().toISOString(),
      });

      return res.json({
        ok: true,
        status: 'unsubscribed',
        email: userData.email,
        name: userData.firstName || userData.username || 'Kursancie',
      });
    } catch (err: any) {
      console.error('[Unsubscribe API Error]:', err);
      return res.status(500).json({ error: 'Błąd zapisu preferencji powiadomień: ' + formatErrorString(err) });
    }
  });

  // =========================================================================
  // DIRECT HOMEWORK ACCESS (Magic Link bez konieczności logowania)
  // =========================================================================

  // Pobranie pracy domowej po unikalnym tokenie dostępowym
  app.get('/api/homework/direct/:token', async (req, res) => {
    try {
      const token = String(req.params.token || req.query.token || '').trim();
      if (!token) {
        return res.status(400).json({ error: 'missing_token', message: 'Brak tokenu dostępowego.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      // 1. Szukaj po accessToken w kolekcji specialTasks
      let taskSnap = await adminDb.collection('specialTasks')
        .where('accessToken', '==', token)
        .limit(1)
        .get();

      // Fallback: jeśli nie znaleziono po accessToken, sprawdź bezpośredni ID dokumentu (o ile ma pasujący format)
      if (taskSnap.empty && token.length > 8) {
        const directDoc = await adminDb.collection('specialTasks').doc(token).get();
        if (directDoc.exists) {
          const dData = directDoc.data();
          if (dData?.accessToken === token || !dData?.accessToken) {
            taskSnap = { empty: false, docs: [directDoc] } as any;
          }
        }
      }

      if (taskSnap.empty) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Nie znaleziono zadania dla podanego linku. Mógł zostać usunięty lub zastąpiony nowym.'
        });
      }

      const taskDoc = taskSnap.docs[0];
      const taskData = taskDoc.data() || {};

      // 2. Weryfikacja daty ważności linku (accessExpiresAt)
      if (taskData.accessExpiresAt) {
        const expiresTime = new Date(taskData.accessExpiresAt).getTime();
        if (expiresTime < Date.now()) {
          return res.status(410).json({
            error: 'expired',
            message: 'Link do tego zadania stracił ważność. Skontaktuj się ze swoim lektorem, aby otrzymać zaktualizowany dostęp.',
            expiresAt: taskData.accessExpiresAt
          });
        }
      }

      // 3. Pobierz imię kursanta dla ciepłego, spersonalizowanego powitania
      let studentDisplayName = taskData.studentName || 'Kursancie';
      const studentUid = taskData.studentUid || taskData.studentId;
      if (studentUid) {
        try {
          const userDoc = await adminDb.collection('users').doc(studentUid).get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            studentDisplayName = uData?.firstName || uData?.username || studentDisplayName;
          }
        } catch (e) {
          console.warn('[Direct Homework] Nie udało się pobrać danych kursanta:', e);
        }
      }

      // 4. Przygotuj bezpieczną wersję ćwiczeń do rozwiązania
      const safeSentences = (taskData.sentences || []).map((s: any, idx: number) => ({
        id: s.id || `s-${idx}`,
        type: s.type || taskData.type || 'translation',
        polishSentence: s.polishSentence || s.prompt || '',
        polishHint: s.polishHint || s.hint || '',
        // Dla word_order udostępniamy rozsypankę słowną:
        chunks: s.chunks || (s.englishTranslation ? s.englishTranslation.split(' ').sort(() => Math.random() - 0.5) : []),
        // Dla multiple_choice:
        question: s.question || s.polishSentence || '',
        options: s.options || [],
        // Dla fill_in_the_blank:
        textWithBlanks: s.textWithBlanks || '',
        blanks: s.blanks || [],
        availableWords: s.availableWords || (s.blanks && typeof s.blanks === 'object' && !Array.isArray(s.blanks) ? Object.values(s.blanks).sort(() => Math.random() - 0.5) : []),
        // Dla find_errors:
        incorrectSentence: s.incorrectSentence || '',
        hint: s.hint || '',
        explanation: s.explanation || ''
      }));

      const isAlreadySubmitted = taskData.status === 'submitted' || taskData.status === 'graded' || taskData.status === 'completed';

      return res.json({
        ok: true,
        task: {
          id: taskDoc.id,
          title: taskData.title || 'Praca domowa',
          type: taskData.type || 'translation',
          types: taskData.types || (taskData.type ? [taskData.type] : []),
          instructions: taskData.instructions || '',
          dueDate: taskData.dueDate || '',
          status: taskData.status || 'pending',
          studentName: studentDisplayName,
          studentId: studentUid,
          sentences: safeSentences,
          studentAnswers: isAlreadySubmitted ? taskData.studentAnswers : undefined,
          evaluationResults: isAlreadySubmitted ? taskData.evaluationResults : undefined,
          submittedAt: taskData.submittedAt || null,
          accessExpiresAt: taskData.accessExpiresAt || null,
          isAlreadySubmitted
        }
      });
    } catch (err: any) {
      console.error('[Direct Homework GET Error]:', err);
      return res.status(500).json({ error: 'server_error', message: 'Wystąpił błąd podczas ładowania pracy domowej: ' + formatErrorString(err) });
    }
  });

  // Bezpośrednie odesłanie wykonanej pracy domowej bez logowania
  app.post('/api/homework/direct-submit', async (req, res) => {
    try {
      const { token, answers, warmupAttempts } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'missing_token', message: 'Brak tokenu dostępowego.' });
      }

      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ error: 'missing_answers', message: 'Brak udzielonych odpowiedzi do oceny.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      const taskSnap = await adminDb.collection('specialTasks')
        .where('accessToken', '==', token.trim())
        .limit(1)
        .get();

      if (taskSnap.empty) {
        return res.status(404).json({ error: 'not_found', message: 'Nie znaleziono zadania dla podanego tokenu.' });
      }

      const taskDoc = taskSnap.docs[0];
      const taskData = taskDoc.data() || {};

      // Sprawdź termin ważności
      if (taskData.accessExpiresAt) {
        const expiresTime = new Date(taskData.accessExpiresAt).getTime();
        if (expiresTime < Date.now()) {
          return res.status(410).json({
            error: 'expired',
            message: 'Termin ważności tego linku minął. Skontaktuj się z lektorem.',
            expiresAt: taskData.accessExpiresAt
          });
        }
      }

      // Sprawdź czy już nie oddano
      if (taskData.status === 'submitted' || taskData.status === 'graded') {
        return res.status(400).json({
          error: 'already_submitted',
          message: 'Ta praca domowa została już wcześniej oddana.',
          submittedAt: taskData.submittedAt
        });
      }

      // Walidacja prób rozgrzewki z tokenowego (nieautoryzowanego logowaniem)
      // klienta — token uprawnia do zapisu wyłącznie DO TEGO zadania, ale
      // kształt danych i tak trzeba ograniczyć, zanim trafi do Firestore.
      const sanitizedWarmupAttempts: Record<string, { answerOrder: string[]; result: string; respondedAt: string }> = {};
      if (warmupAttempts && typeof warmupAttempts === 'object') {
        for (const [key, value] of Object.entries(warmupAttempts as Record<string, any>)) {
          const idx = Number(key);
          if (!Number.isInteger(idx) || idx < 0) continue;
          const order = Array.isArray(value?.answerOrder) ? value.answerOrder.map((w: any) => String(w)).slice(0, 40) : null;
          const result = typeof value?.result === 'string' && ['correct', 'close', 'incorrect'].includes(value.result) ? value.result : null;
          if (!order || !result) continue;
          sanitizedWarmupAttempts[String(idx)] = { answerOrder: order, result, respondedAt: new Date().toISOString() };
        }
      }

      const items = taskData.sentences || [];
      const normalizeSimple = (str: any) =>
        String(str || '')
          .toLowerCase()
          .replace(/[.,!?;:"„”]/g, '')
          .replace(/[’']/g, "'")
          .replace(/\s+/g, ' ')
          .trim();

      // Automatyczna ewaluacja odpowiedzi
      const rows: any[] = [];
      const storedAnswers: Record<number, any> = {};

      items.forEach((item: any, i: number) => {
        const itemType = item.type || taskData.type || 'translation';
        const rawAns = answers[i];
        storedAnswers[i] = rawAns;

        let isCorrect = false;
        let score = 0;
        let expectedStr = item.englishTranslation || item.correctSentence || '';
        let studentStr = '';

        if (itemType === 'word_order') {
          // chunks order
          if (Array.isArray(rawAns)) {
            studentStr = rawAns.map((idx: number) => item.chunks?.[idx]).filter(Boolean).join(' ');
          } else {
            studentStr = String(rawAns || '');
          }
          if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
            isCorrect = true;
            score = 100;
          }
        } else if (itemType === 'multiple_choice') {
          studentStr = typeof rawAns === 'number' ? item.options?.[rawAns] || '' : String(rawAns || '');
          const expectedOption = typeof item.correctOptionIndex === 'number' ? item.options?.[item.correctOptionIndex] : (item.options?.[0] || '');
          expectedStr = expectedOption;
          if (rawAns === item.correctOptionIndex || normalizeSimple(studentStr) === normalizeSimple(expectedOption)) {
            isCorrect = true;
            score = 100;
          }
        } else if (itemType === 'fill_in_the_blank') {
          const blanksObj = typeof rawAns === 'object' && rawAns !== null ? rawAns : {};
          studentStr = Object.keys(blanksObj).sort().map(k => `${k}: ${blanksObj[k]}`).join(', ');
          
          let totalBlanks = item.blanks?.length || 1;
          let correctBlanks = 0;
          if (item.blanks && Array.isArray(item.blanks)) {
            item.blanks.forEach((b: any) => {
              const expectedVal = normalizeSimple(b.correctAnswer || b.word || b.answer || '');
              const userVal = normalizeSimple(blanksObj[b.id] || blanksObj[`BLANK_${b.id}`] || '');
              if (expectedVal && userVal && (expectedVal === userVal || userVal.includes(expectedVal))) {
                correctBlanks++;
              }
            });
          }
          score = Math.round((correctBlanks / totalBlanks) * 100);
          isCorrect = score >= 80;
        } else if (itemType === 'find_errors') {
          studentStr = String(rawAns || '').trim();
          expectedStr = item.correctSentence || '';
          if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
            isCorrect = true;
            score = 100;
          } else if (normalizeSimple(studentStr).length > 5) {
            score = 70;
            isCorrect = true;
          }
        } else if (itemType === 'matching') {
          const matched: string[] = Array.isArray(rawAns) ? rawAns : [];
          const pairs: Array<{ id: string; left: string; right: string }> = Array.isArray(item.pairs) ? item.pairs : [];
          studentStr = matched
            .map((id: string) => pairs.find((p) => p.id === id))
            .filter(Boolean)
            .map((p: any) => `${p.left} = ${p.right}`)
            .join(', ');
          expectedStr = pairs.map((p) => `${p.left} = ${p.right}`).join(', ');
          score = pairs.length > 0 ? Math.round((matched.length / pairs.length) * 100) : 0;
          isCorrect = score === 100;
        } else {
          // translation
          studentStr = String(rawAns || '').trim();
          expectedStr = item.englishTranslation || '';
          if (normalizeSimple(studentStr) === normalizeSimple(expectedStr)) {
            isCorrect = true;
            score = 100;
          } else if (normalizeSimple(studentStr).length > 3) {
            score = 75; // wstępna punktacja, lektor zweryfikuje niuanse
            isCorrect = true;
          }
        }

        rows.push({
          polishSentence: item.polishSentence || item.prompt || '',
          correctTranslation: expectedStr,
          studentAnswer: studentStr || rawAns,
          isCorrect,
          score,
          explanation: item.explanation || undefined
        });
      });

      const averageScore = rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length)
        : 0;

      const nowIso = new Date().toISOString();

      // Aktualizacja dokumentu w specialTasks. Brak wcześniejszego zapisu
      // rozgrzewki dla tej ścieżki (kursant bez logowania nie ma stałego
      // połączenia z Firestore) — `warmup` dokłada się tu bezpiecznie, bez
      // ryzyka nadpisania czegokolwiek, bo to jedyny zapis tego dokumentu.
      await taskDoc.ref.update({
        status: 'submitted',
        studentAnswers: Object.keys(sanitizedWarmupAttempts).length > 0
          ? { ...storedAnswers, warmup: sanitizedWarmupAttempts }
          : storedAnswers,
        evaluationResults: rows,
        submittedAt: nowIso,
        submittedViaDirectLink: true,
        updatedAt: nowIso
      });

      // Zapis do profilu kursanta (users/{studentUid})
      const studentUid = taskData.studentUid || taskData.studentId;
      if (studentUid) {
        try {
          await adminDb.collection('users').doc(studentUid).collection('practiceLogs').add({
            exerciseType: 'homework',
            exerciseFormat: taskData.type || 'mixed',
            date: nowIso,
            isRevisionMode: false,
            score: averageScore,
            totalWords: items.length,
            setDisplayName: taskData.title || 'Praca domowa',
            exercisesData: rows,
            submittedViaDirectLink: true,
            taskId: taskDoc.id
          });

          await adminDb.collection('users').doc(studentUid).update({
            hasNewHomework: false,
            lastHomeworkSubmittedAt: nowIso,
            lastActivity: nowIso
          }).catch(() => {});

          // Zasil profil krzywej uczenia (learningCurve) kursanta
          try {
            const profileDocRef = adminDb.collection('users').doc(studentUid).collection('profile').doc('learningCurve');
            const [profileSnap, userSnap] = await Promise.all([
              profileDocRef.get(),
              adminDb.collection('users').doc(studentUid).get(),
            ]);
            const baseLevel = normalizeLevel(userSnap.data()?.level);
            const currentProfile = profileSnap.exists
              ? deserializeLearningProfile(studentUid, profileSnap.data() || {}, baseLevel)
              : createProfile(studentUid, baseLevel, nowIso);
            const attempts = rows.map((r, idx) => ({
              prompt: r.polishSentence || items[idx]?.polishSentence || '',
              expected: r.correctTranslation || items[idx]?.englishTranslation || '',
              given: r.studentAnswer || '',
              isCorrect: r.isCorrect,
              score: r.score,
              level: baseLevel,
              exerciseType: items[idx]?.type || taskData.type || 'homework',
              date: nowIso,
            }));
            const { profile } = ingestAttempts(currentProfile, attempts, nowIso);
            await profileDocRef.set(serializeLearningProfile(profile, currentProfile.createdAt || nowIso));
          } catch (lcErr) {
            console.warn('[Direct Homework] Błąd aktualizacji profilu krzywej uczenia:', lcErr);
          }
        } catch (dbErr) {
          console.warn('[Direct Homework] Błąd zapisu do profilu kursanta:', dbErr);
        }
      }

      return res.json({
        ok: true,
        score: averageScore,
        rows,
        submittedAt: nowIso,
        studentName: taskData.studentName || 'Kursancie'
      });
    } catch (err: any) {
      console.error('[Direct Homework Submit Error]:', err);
      return res.status(500).json({ error: 'server_error', message: 'Wystąpił błąd podczas wysyłania pracy domowej: ' + formatErrorString(err) });
    }
  });

  // Admin mailing status
  app.get('/api/mailing/status', requireFirebaseAdmin, async (_req, res) => {
    try {
      let dbKey: string | null = null;
      let enableBccSender = true;
      let bccEmail = 'wyrozumski@maciej.pro';
      let dbFromAddress: string | null = null;

      if (adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          const mailingDoc = await adminDb.collection('system').doc('mailing').get();
          if (mailingDoc.exists) {
            const data = mailingDoc.data();
            if (data?.resendApiKey) {
              dbKey = String(data.resendApiKey).trim();
            }
            if (typeof data?.enableBccSender === 'boolean') {
              enableBccSender = data.enableBccSender;
            }
            if (data?.bccEmail && typeof data.bccEmail === 'string') {
              bccEmail = data.bccEmail.trim();
            }
            if (data?.senderEmail) {
              const name = data.senderName || 'Maciej Wyrozumski';
              dbFromAddress = `${name} <${data.senderEmail}>`;
            }
          }
        } catch {}
      }

      const envKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : null;
      const activeKey = envKey || dbKey;
      const maskedKey = activeKey ? `${activeKey.slice(0, 6)}••••${activeKey.slice(-4)}` : null;

      return res.json({
        configured: !!activeKey,
        hasEnvKey: !!envKey,
        hasDbKey: !!dbKey,
        maskedKey,
        fromAddress: dbFromAddress || process.env.FROM_ADDRESS || 'Maciej Wyrozumski <wyrozumski@maciej.pro>',
        enableBccSender,
        bccEmail,
      });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     SILNIK PRAC DOMOWYCH V2 (GEMINI 2.5 FLASH)
     ═══════════════════════════════════════════════════════════════════ */
  app.post('/api/homework-v2/generate', requireFirebaseAuth, async (req, res) => {
    try {
      // Ta sama kanoniczna bramka co Functions (`endpoints.ts`,
      // `requireHomeworkEngineV2`) — jedno źródło interpretacji env zamiast
      // dwóch, żeby flaga nie mogła być włączona po jednej stronie i
      // wyłączona po drugiej (patrz AGENT_LOG.md, hotfix P0, 2026-09-20).
      if (!isHomeworkEngineV2Enabled()) {
        return res.status(412).json({ error: ENGINE_DISABLED_MESSAGE });
      }

      const studentUid = String(req.body?.studentUid || '').trim();
      if (!studentUid) return res.status(400).json({ error: 'Nie wskazano kursanta.' });

      const lessonIds = Array.isArray(req.body?.lessonIds) ? req.body.lessonIds : [];
      if (lessonIds.length === 0) return res.status(400).json({ error: 'Nie wskazano lekcji.' });

      const itemCount = Number(req.body?.itemCount) || 6;
      const plannedMinutes = Number(req.body?.plannedMinutes) || 0;
      const requestedTypes = req.body?.types;
      const teacherId = (req as any).userUid;

      const rawLessons = Array.isArray(req.body?.rawLessons) ? req.body.rawLessons : undefined;
      let cefr = String(req.body?.cefr || 'B1');
      let recentMistakes: string[] = [];

      try {
        const adminApp = getAdminApp();
        const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
        const studentSnap = await adminDb.collection('users').doc(studentUid).get();
        if (studentSnap.exists) {
          cefr = String(studentSnap.data()?.level || cefr);
        }
        recentMistakes = await getRecentMistakes(studentUid);
      } catch (dbErr) {
        console.warn('[server] pomijam zapytanie Admin DB przy generowaniu prac domowych v2:', dbErr);
      }

      const context = await assembleContext({
        studentUid,
        lessonIds,
        cefr,
        recentMistakes,
        rawLessons,
      });

      const plan = planExercises({ context, requestedTypes, itemCount, plannedMinutes });

      const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

      const aiCall = createAiCall({
        geminiApiKey: geminiKey,
      });

      const result = await buildExerciseSet({
        context,
        plan,
        call: aiCall,
        teacherId,
        studentId: studentUid,
      });

      return res.json({
        exercises: result.exercises,
        warnings: result.warnings,
        needsReviewCount: result.needsReviewCount,
        schemaVersion: SCHEMA_VERSION,
      });
    } catch (err: any) {
      console.error('[server] błąd generowania pracy domowej v2:', err);
      return res.status(500).json({ error: err?.message || 'Nie udało się ułożyć zestawu.' });
    }
  });

  app.post('/api/homework-v2/assign', requireFirebaseAuth, async (req, res) => {
    try {
      const rawExercises = Array.isArray(req.body?.exercises) ? req.body.exercises : [];
      const studentUids = Array.isArray(req.body?.studentUids) ? req.body.studentUids : [];
      const studentNames = (typeof req.body?.studentNames === 'object' && req.body?.studentNames !== null) ? req.body.studentNames : {};
      const studentEmails = (typeof req.body?.studentEmails === 'object' && req.body?.studentEmails !== null) ? req.body.studentEmails : {};
      const studentUsernames = (typeof req.body?.studentUsernames === 'object' && req.body?.studentUsernames !== null) ? req.body.studentUsernames : {};
      const title = String(req.body?.title || 'Praca domowa').trim();
      const dueDate = String(req.body?.dueDate || '').trim();
      const groupId = String(req.body?.groupId || '').trim();
      const teacherId = (req as any).userUid;

      if (studentUids.length === 0) return res.status(400).json({ error: 'Nie wskazano kursantów.' });

      const exercises = selectSendableExercises(rawExercises);
      if (exercises.length === 0) {
        return res.status(400).json({ error: 'Żadne z zadań nie nadaje się do wysłania.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      const nowIso = new Date().toISOString();
      const homeworkSetId = newHomeworkSetId();

      const created: string[] = [];

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
          createdAt: nowIso,
        });

        const ref = await adminDb.collection('specialTasks').add(payload);
        created.push(ref.id);

        try {
          await adminDb.collection('users').doc(studentUid).update({ hasNewHomework: true });
        } catch {}
      }

      return res.json({ taskIds: created, homeworkSetId, assignedCount: exercises.length });
    } catch (err: any) {
      console.error('[server] błąd przypisywania pracy domowej v2:', err);
      return res.status(500).json({ error: err?.message || 'Nie udało się przypisać zestawu.' });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     KONFIGURACJA AI — WYBÓR MODELI I KLUCZE

     ══ DWA POZIOMY DOSTĘPU W JEDNYM DOKUMENCIE ══

     `system/ai` trzyma i wybór modeli, i klucze API. Wybór modeli musi
     przeczytać KAŻDA zalogowana osoba, bo aplikacja nim liczy; klucze nie mogą
     opuścić serwera nigdy. Dlatego odczyt jest dla zalogowanych, ale zwraca
     wyłącznie modele i ZAMASKOWANE klucze, a pełną wartość zna tylko proces
     serwera. Otwarcie reguły odczytu na kolekcji `system` znaczyłoby, że klucz
     OpenAI da się pobrać z przeglądarki dowolnego kursanta.

     ══ ŹRÓDŁO KLUCZA ══

     Klucz może pochodzić ze zmiennej środowiskowej (wdrożenie) albo z zapisu
     w aplikacji. Odpowiedź mówi które, żeby administrator wiedział, czy
     nadpisuje wdrożenie, czy uzupełnia brak — bez tego „klucz jest ustawiony"
     nie mówi nic o tym, gdzie go szukać.
     ═══════════════════════════════════════════════════════════════════════ */

  const AI_KEY_ENV: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    elevenlabs: 'ELEVENLABS_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
  };

  const maskKey = (key: string): string =>
    key.length <= 10 ? '••••' : `${key.slice(0, 6)}••••${key.slice(-4)}`;

  const AI_SETTINGS_FILE = path.resolve(process.cwd(), '.ai-settings.json');

  const readAiSettings = async (): Promise<any> => {
    let firestoreData: any = null;
    if (adminApp) {
      try {
        const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
        const snap = await adminDb.collection('system').doc('ai').get();
        if (snap.exists && snap.data()) {
          firestoreData = snap.data();
        }
      } catch (e) {
        // brak poświadczeń Admin w środowisku dev
      }
    }

    let localData: any = null;
    try {
      if (fs.existsSync(AI_SETTINGS_FILE)) {
        localData = JSON.parse(fs.readFileSync(AI_SETTINGS_FILE, 'utf8'));
      }
    } catch {}

    return { ...(localData || {}), ...(firestoreData || {}) };
  };

  app.get('/api/ai/config', requireFirebaseAuth, async (_req, res) => {
    try {
      const settings = await readAiSettings();
      const keys: Record<string, any> = {};

      for (const [provider, envName] of Object.entries(AI_KEY_ENV)) {
        const fromEnv = (process.env[envName] || '').trim();
        const fromApp = String(settings?.keys?.[provider] || '').trim();
        const effective = fromApp || fromEnv;
        keys[provider] = effective
          ? { configured: true, maskedKey: maskKey(effective), source: fromApp ? 'app' : 'env' }
          : { configured: false };
      }

      return res.json({ models: settings?.models || {}, council: settings?.council || null, keys });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  app.post('/api/ai/config', requireFirebaseAdmin, async (req, res) => {
    try {
      const { models, council } = req.body || {};
      if ((!models || typeof models !== 'object') && !council) {
        return res.status(400).json({ error: 'Brak wyboru modeli do zapisania.' });
      }

      // Przyjmujemy WYŁĄCZNIE znane zadania i znane modele. Bez tego dowolny
      // ciąg z przeglądarki trafiałby prosto do nazwy modelu w wywołaniu API.
      const allowedTasks = ['exercises', 'grading', 'chat', 'summaries'];
      const allowedModels = [
        'openai/gpt-5.6-luna',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'openai/o3-mini',
        'gemini-2.5-flash',
        'gemini-3.8-flash',
        'gemini-2.5-pro',
        'anthropic/claude-3-7-sonnet',
        'anthropic/claude-3-5-sonnet',
        'anthropic/claude-3-5-haiku',
        'deepseek/deepseek-chat',
        'deepseek/deepseek-reasoner',
      ];

      const clean: Record<string, string> = {};
      for (const [task, model] of Object.entries(models || {})) {
        if (!allowedTasks.includes(task)) continue;
        if (typeof model !== 'string' || !allowedModels.includes(model)) continue;
        clean[task] = model;
      }

      /*
       * ══ SKŁAD NARADY ══
       *
       * Cztery miejsca, każde z modelem i rolą. Walidacja jest tu z tego
       * samego powodu, co przy `models`: nazwa modelu z tego zapisu trafia
       * potem wprost do wywołania API, więc dowolny ciąg z przeglądarki
       * byłby wywołaniem dowolnego adresu. Przycinamy do czterech miejsc,
       * bo więcej głosów to wyłącznie więcej kosztu i czasu — narada
       * przestaje wtedy dokładać cokolwiek do jakości.
       *
       * Pierwsze miejsce jest autorem bez względu na to, co przyszło:
       * bez autora nie ma czego recenzować.
       */
      let cleanCouncil: any = undefined;
      if (council && typeof council === 'object') {
        const seatsIn = Array.isArray(council.seats) ? council.seats.slice(0, 4) : [];
        cleanCouncil = {
          enabled: Boolean(council.enabled),
          seats: seatsIn.map((seat: any, index: number) => ({
            id: `seat-${index + 1}`,
            model: allowedModels.includes(String(seat?.model)) ? String(seat.model) : allowedModels[0],
            role: index === 0 ? 'author' : 'reviewer',
            enabled: index === 0 ? true : Boolean(seat?.enabled),
          })),
        };
      }

      // Zapis do pliku lokalnego .ai-settings.json (gwarancja natychmiastowej trwałości w dev)
      try {
        let currentData: any = {};
        if (fs.existsSync(AI_SETTINGS_FILE)) {
          currentData = JSON.parse(fs.readFileSync(AI_SETTINGS_FILE, 'utf8'));
        }
        const updated = {
          ...currentData,
          ...(models ? { models: clean } : {}),
          ...(cleanCouncil ? { council: cleanCouncil } : {}),
          updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(AI_SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
      } catch (e) {
        console.warn('Nie udało się zapisać wyboru modeli do .ai-settings.json:', e);
      }

      if (adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection('system').doc('ai').set(
            {
              ...(models ? { models: clean } : {}),
              ...(cleanCouncil ? { council: cleanCouncil } : {}),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn('[AI] Nie udało się zapisać konfiguracji do Firestore (brak poświadczeń Admin):', dbErr);
        }
      }

      return res.json({ ok: true, models: clean, council: cleanCouncil });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  app.post('/api/ai/save-key', requireFirebaseAdmin, async (req, res) => {
    try {
      const { provider, apiKey } = req.body || {};
      const envName = AI_KEY_ENV[String(provider)];
      if (!envName) {
        return res.status(400).json({ error: 'Nieznany dostawca klucza.' });
      }
      if (typeof apiKey !== 'string' || apiKey.trim().length < 12) {
        return res.status(400).json({ error: 'Podaj pełny klucz API.' });
      }

      const cleanKey = apiKey.trim();
      process.env[envName] = cleanKey;
      if (provider === 'gemini') {
        process.env.VITE_GEMINI_API_KEY = cleanKey;
      }

      // Zapis do lokalnego .env
      try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, 'utf8');
          const regex = new RegExp(`${envName}=.*(\\r?\\n|$)`);
          if (content.includes(`${envName}=`)) {
            content = content.replace(regex, `${envName}=${cleanKey}\n`);
          } else {
            content += `\n${envName}=${cleanKey}\n`;
          }
          if (provider === 'gemini') {
            if (content.includes('VITE_GEMINI_API_KEY=')) {
              content = content.replace(/VITE_GEMINI_API_KEY=.*(\r?\n|$)/, `VITE_GEMINI_API_KEY=${cleanKey}\n`);
            }
          }
          fs.writeFileSync(envPath, content, 'utf8');
        }
      } catch (e) {
        console.warn(`Nie udało się zapisać ${envName} w .env:`, e);
      }

      // Zapis do lokalnego .ai-settings.json
      try {
        let currentData: any = {};
        if (fs.existsSync(AI_SETTINGS_FILE)) {
          currentData = JSON.parse(fs.readFileSync(AI_SETTINGS_FILE, 'utf8'));
        }
        const updated = {
          ...currentData,
          keys: { ...(currentData.keys || {}), [String(provider)]: cleanKey },
          updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(AI_SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
      } catch (e) {
        console.warn('Nie udało się zapisać klucza do .ai-settings.json:', e);
      }

      if (adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection('system').doc('ai').set(
            { keys: { [String(provider)]: cleanKey }, updatedAt: new Date().toISOString() },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn('[AI] Nie udało się zapisać klucza do Firestore (brak poświadczeń Admin):', dbErr);
        }
      }

      return res.json({ ok: true, maskedKey: maskKey(cleanKey) });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Admin mailing save Resend API key
  app.post('/api/mailing/save-key', requireFirebaseAdmin, async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim().startsWith('re_')) {
        return res.status(400).json({ error: 'Podaj poprawny klucz Resend API (musi zaczynać się od "re_").' });
      }

      const cleanKey = apiKey.trim();
      process.env.RESEND_API_KEY = cleanKey;

      // Persist to local .env if file exists
      try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, 'utf8');
          if (content.includes('RESEND_API_KEY=')) {
            content = content.replace(/RESEND_API_KEY=.*(\r?\n|$)/, `RESEND_API_KEY=${cleanKey}\n`);
          } else {
            content += `\nRESEND_API_KEY=${cleanKey}\n`;
          }
          fs.writeFileSync(envPath, content, 'utf8');
        }
      } catch (e) {
        console.warn('Nie udało się zapisać RESEND_API_KEY do .env:', e);
      }

      // Persist to Firestore system/mailing
      if (adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection('system').doc('mailing').set({
            resendApiKey: cleanKey,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('Nie udało się zapisać resendApiKey do Firestore:', e);
        }
      }

      return res.json({
        ok: true,
        maskedKey: `${cleanKey.slice(0, 6)}••••${cleanKey.slice(-4)}`,
        message: 'Klucz Resend API został pomyślnie zapisany i uaktywniony.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Powiadomienie e-mail i in-app o sprawdzonej pracy domowej
  app.post('/api/homework/notify-graded', requireFirebaseAuth, async (req, res) => {
    try {
      const { studentUid, taskId, taskTitle, score, teacherFeedback, teacherName } = req.body;
      if (!studentUid) {
        return res.status(400).json({ error: 'Brak studentUid.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      const userDocRef = adminDb.collection('users').doc(studentUid);
      const userSnap = await userDocRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: 'Kursant nie istnieje.' });
      }

      const userData = userSnap.data() || {};
      const nowIso = new Date().toISOString();

      // Aktualizacja profilu kursanta (wyskakujący pop-up na żywo w aplikacji)
      await userDocRef.update({
        hasGradedHomework: true,
        lastGradedHomeworkId: taskId || '',
        lastGradedHomeworkTitle: taskTitle || 'Praca domowa',
        lastGradedFeedback: teacherFeedback || '',
        lastGradedScore: typeof score === 'number' ? score : null,
        lastGradedHomeworkSentAt: nowIso,
      });

      // Sprawdzenie czy kursant ma adres e-mail i czy nie wyłączył powiadomień
      const studentEmail = userData.email;
      if (studentEmail && studentEmail.includes('@') && !userData.emailNotificationsDisabled) {
        let apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          try {
            const mailingDoc = await adminDb.collection('system').doc('mailing').get();
            if (mailingDoc.exists && mailingDoc.data()?.resendApiKey) {
              apiKey = String(mailingDoc.data()?.resendApiKey).trim();
            }
          } catch {}
        }

        if (apiKey) {
          const studentName = userData.firstName || userData.name || userData.username || '';
          const emailData = buildGradedHomeworkEmail({
            studentName,
            title: taskTitle || 'Praca domowa',
            score: typeof score === 'number' ? score : null,
            teacherFeedback,
            gradedBy: teacherName || 'Maciej Wyrozumski',
            appUrl: process.env.APP_URL || 'https://app.maciej.pro',
          });

          let fromAddress = process.env.FROM_ADDRESS || 'Maciej Wyrozumski <wyrozumski@maciej.pro>';
          try {
            const mailingDoc = await adminDb.collection('system').doc('mailing').get();
            if (mailingDoc.exists && mailingDoc.data()?.senderEmail) {
              fromAddress = `${mailingDoc.data()?.senderName || 'Maciej Wyrozumski'} <${mailingDoc.data()?.senderEmail}>`;
            }
          } catch {}

          const resendPayload: any = {
            from: fromAddress,
            to: [studentEmail.trim()],
            reply_to: 'wyrozumski@maciej.pro',
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
          };

          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey.trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(resendPayload),
          });

          if (response.ok) {
            console.log(`[Graded Homework Email Sent] Do ${studentEmail} dla zadania ${taskId}`);
          } else {
            console.warn(`[Graded Homework Email Warning] Resend status ${response.status}`);
          }
        }
      }

      return res.json({ ok: true, message: 'Powiadomienie zapisane i wysłane.' });
    } catch (err: any) {
      console.error('[Notify Graded Homework Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Admin mailing test email sender
  app.post('/api/mailing/test-send', requireFirebaseAdmin, async (req, res) => {
    try {
      const { to, from: clientFrom, subject, html, text, apiKey: clientApiKey, replyTo, bcc: clientBcc } = req.body;
      if (!to || typeof to !== 'string' || !to.includes('@')) {
        return res.status(400).json({ error: 'Wymagany jest poprawny adres e-mail odbiorcy.' });
      }

      let apiKey = (typeof clientApiKey === 'string' && clientApiKey.trim()) || process.env.RESEND_API_KEY;

      if (!apiKey && adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          const mailingDoc = await adminDb.collection('system').doc('mailing').get();
          if (mailingDoc.exists && mailingDoc.data()?.resendApiKey) {
            apiKey = String(mailingDoc.data()?.resendApiKey).trim();
          }
        } catch {}
      }

      // If key was supplied in request body and valid, persist it
      if (clientApiKey && typeof clientApiKey === 'string' && clientApiKey.trim().startsWith('re_')) {
        const cleanKey = clientApiKey.trim();
        process.env.RESEND_API_KEY = cleanKey;
        try {
          const envPath = path.resolve(process.cwd(), '.env');
          if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf8');
            if (content.includes('RESEND_API_KEY=')) {
              content = content.replace(/RESEND_API_KEY=.*(\r?\n|$)/, `RESEND_API_KEY=${cleanKey}\n`);
            } else {
              content += `\nRESEND_API_KEY=${cleanKey}\n`;
            }
            fs.writeFileSync(envPath, content, 'utf8');
          }
        } catch (e) {
          console.warn('Nie udało się zapisać RESEND_API_KEY do .env:', e);
        }
      }

      if (!apiKey) {
        return res.status(500).json({
          error: 'Brak klucza API Resend na serwerze. Wprowadź klucz RESEND_API_KEY (zaczynający się od "re_") w zakładce Ustawienia lub poniżej w oknie testowym.',
        });
      }

      let fromAddress = (typeof clientFrom === 'string' && clientFrom.trim()) || process.env.FROM_ADDRESS;
      let systemBccEmail: string | null = null;
      let systemEnableBcc = true;

      if (adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          const mailingDoc = await adminDb.collection('system').doc('mailing').get();
          if (mailingDoc.exists) {
            const data = mailingDoc.data();
            if (!fromAddress && data?.senderEmail) {
              const name = data.senderName || 'Maciej Wyrozumski';
              fromAddress = `${name} <${data.senderEmail}>`;
            }
            if (typeof data?.enableBccSender === 'boolean') {
              systemEnableBcc = data.enableBccSender;
            }
            if (data?.bccEmail && typeof data.bccEmail === 'string') {
              systemBccEmail = data.bccEmail.trim();
            }
          }
        } catch {}
      }
      if (!fromAddress) {
        fromAddress = 'Maciej Wyrozumski <wyrozumski@maciej.pro>';
      }

      const replyToAddress = (typeof replyTo === 'string' && replyTo.trim()) || process.env.REPLY_TO_ADDRESS || 'wyrozumski@maciej.pro';

      // Determine BCC (Blind Carbon Copy)
      let bccToUse: string[] | undefined = undefined;
      if (clientBcc) {
        if (Array.isArray(clientBcc)) {
          bccToUse = clientBcc.map((b: any) => String(b).trim()).filter((b: string) => b.includes('@'));
        } else if (typeof clientBcc === 'string' && clientBcc.trim().includes('@')) {
          bccToUse = [clientBcc.trim()];
        }
      } else if (clientBcc !== false && systemEnableBcc && systemBccEmail && systemBccEmail.includes('@')) {
        bccToUse = [systemBccEmail];
      }

      const resendPayload: any = {
        from: fromAddress,
        to: [to.trim()],
        reply_to: replyToAddress,
        subject: subject || 'Powiadomienie CRIBRO ENGLISH',
        html: html || '<p>To jest testowa wiadomość wysłana z panelu CRIBRO ENGLISH.</p>',
        text: text || 'To jest testowa wiadomość wysłana z panelu CRIBRO ENGLISH.',
      };

      if (bccToUse && bccToUse.length > 0) {
        resendPayload.bcc = bccToUse;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendPayload),
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {}

      if (!response.ok) {
        let msg = data?.message || data?.error || raw.slice(0, 300);
        if (typeof msg === 'string' && (msg.toLowerCase().includes('domain') || msg.toLowerCase().includes('not verified') || msg.toLowerCase().includes('validation') || response.status === 403)) {
          msg += ' [Wskazówka: Aby wysyłać z adresu @maciej.pro lub @learnwithmaciej.com, dodaj domenę w https://resend.com/domains i zweryfikuj rekordy DNS w Hostingerze].';
        }
        return res.status(response.status).json({ error: `Resend ${response.status}: ${msg}` });
      }

      return res.json({ ok: true, id: data?.id, bcc: bccToUse });
    } catch (err: any) {
      console.error('[Mailing Test Send Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Webhook for receiving inbound emails (Resend Inbound Webhook)
  app.post('/api/mailing/inbound-webhook', async (req, res) => {
    try {
      const payload = req.body?.data || req.body || {};
      const rawFrom = String(payload.from || payload.sender || '');
      const to = Array.isArray(payload.to) ? payload.to.join(', ') : String(payload.to || '');
      const subject = String(payload.subject || '(Bez tematu)');
      const text = String(payload.text || payload.body || '');
      const html = String(payload.html || '');

      const emailMatch = rawFrom.match(/<([^>]+)>/) || [null, rawFrom.trim()];
      const fromEmail = (emailMatch[1] || rawFrom).trim().toLowerCase();
      const fromName = rawFrom.includes('<') ? rawFrom.split('<')[0].trim().replace(/"/g, '') : fromEmail;

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      let studentId: string | null = null;
      let studentName: string | null = null;

      if (fromEmail) {
        const snap = await adminDb.collection('users').where('email', '==', fromEmail).limit(1).get();
        if (!snap.empty) {
          const uDoc = snap.docs[0];
          const data = uDoc.data();
          studentId = uDoc.id;
          studentName = (data.firstName || data.lastName)
            ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
            : data.username || fromName;
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
        receivedAt: new Date().toISOString(),
        read: false,
        archived: false,
      };

      const docRef = await adminDb.collection('inboundMessages').add(newMsg);
      console.log(`[Inbound Email Received]: ID ${docRef.id} from ${fromEmail}`);

      return res.json({ ok: true, id: docRef.id });
    } catch (err: any) {
      console.error('[Inbound Webhook Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Admin list inbound messages
  app.get('/api/mailing/inbound-messages', requireFirebaseAdmin, async (req, res) => {
    try {
      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      const snap = await adminDb.collection('inboundMessages').orderBy('receivedAt', 'desc').limit(100).get();
      const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.json({ ok: true, messages });
    } catch (err: any) {
      console.error('[Get Inbound Messages Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Admin toggle message read status
  app.patch('/api/mailing/inbound-messages/:id', requireFirebaseAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const { read } = req.body;
      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      await adminDb.collection('inboundMessages').doc(id).update({ read: Boolean(read) });
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('[Patch Inbound Message Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Admin delete inbound message
  app.delete('/api/mailing/inbound-messages/:id', requireFirebaseAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      await adminDb.collection('inboundMessages').doc(id).delete();
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('[Delete Inbound Message Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Admin simulate inbound email for quick testing
  app.post('/api/mailing/simulate-inbound', requireFirebaseAdmin, async (req, res) => {
    try {
      const { fromEmail, fromName, subject, text } = req.body;
      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      const targetEmail = (fromEmail || 'kursant@example.com').trim().toLowerCase();
      let studentId: string | null = null;
      let resolvedName = fromName || 'Przykładowy Kursant';

      const snap = await adminDb.collection('users').where('email', '==', targetEmail).limit(1).get();
      if (!snap.empty) {
        const uDoc = snap.docs[0];
        const data = uDoc.data();
        studentId = uDoc.id;
        resolvedName = (data.firstName || data.lastName)
          ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
          : data.username || resolvedName;
      }

      const newMsg = {
        fromEmail: targetEmail,
        fromName: resolvedName,
        studentId,
        studentName: resolvedName,
        toEmail: 'wyrozumski@maciej.pro',
        subject: subject || 'Pytanie do ostatniej pracy domowej',
        text: text || 'Cześć! Mam pytanie odnośnie zadania z czasem Present Perfect. Kiedy dokładnie używamy "since" zamiast "for"? Pozdrawiam!',
        html: `<p>${text || 'Cześć! Mam pytanie odnośnie zadania z czasem Present Perfect. Kiedy dokładnie używamy "since" zamiast "for"? Pozdrawiam!'}</p>`,
        receivedAt: new Date().toISOString(),
        read: false,
        archived: false,
      };

      const docRef = await adminDb.collection('inboundMessages').add(newMsg);
      return res.json({ ok: true, id: docRef.id, message: newMsg });
    } catch (err: any) {
      console.error('[Simulate Inbound Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     NOTION API INTEGRATION & TRANSCRIPTS FETCHER
     ═══════════════════════════════════════════════════════════════════ */

  const DEFAULT_NOTION_LESSONS_DB = '';
  const DEFAULT_NOTION_STUDENTS_DB = '';

  function normalizeNotionId(input?: string | null): string {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim();
    // Match 36-char hyphenated UUID or 32-char hex string from raw ID or full Notion URL
    const match = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32})/i);
    if (match) {
      const clean = match[1].replace(/-/g, '').toLowerCase();
      return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
    }
    return trimmed;
  }

  async function getNotionConfig() {
    let token = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || '';
    let meetingNotesDbId = normalizeNotionId(process.env.NOTION_LESSONS_DB || DEFAULT_NOTION_LESSONS_DB);
    let studentsDbId = normalizeNotionId(process.env.NOTION_STUDENTS_DB || DEFAULT_NOTION_STUDENTS_DB);
    let autoFetchEnabled = false;
    let autoFetchIntervalMinutes = 30;
    let lastFetchTime: string | null = null;
    let lastFetchStatus: string | null = null;

    if (adminApp) {
      try {
        const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
        const notionDoc = await adminDb.collection('system').doc('notion').get();
        if (notionDoc.exists) {
          const data = notionDoc.data() || {};
          token = typeof data.token === 'string' ? data.token.trim() : token;
          meetingNotesDbId = typeof data.meetingNotesDbId === 'string' ? normalizeNotionId(data.meetingNotesDbId) : meetingNotesDbId;
          studentsDbId = typeof data.studentsDbId === 'string' ? normalizeNotionId(data.studentsDbId) : studentsDbId;
          if (typeof data.autoFetchEnabled === 'boolean') autoFetchEnabled = data.autoFetchEnabled;
          if (typeof data.autoFetchIntervalMinutes === 'number') autoFetchIntervalMinutes = data.autoFetchIntervalMinutes;
          if (data.lastFetchTime) lastFetchTime = String(data.lastFetchTime);
          if (data.lastFetchStatus) lastFetchStatus = String(data.lastFetchStatus);
        }
      } catch (e) {
        console.warn('[Notion] Nie udało się odczytać konfiguracji z Firestore:', e);
      }
    }

    return {
      token,
      meetingNotesDbId,
      studentsDbId,
      autoFetchEnabled,
      autoFetchIntervalMinutes,
      lastFetchTime,
      lastFetchStatus,
    };
  }

  // `fetchNotionBlocksText` (import, paginacja, głębokość, ponowienia) mieszka
  // w utils/notionBlocksFetcher.ts — wydzielone, żeby dało się to przetestować
  // bez uruchamiania całego serwera Express.

  // 1. GET /api/notion/config
  app.get('/api/notion/config', requireFirebaseAdmin, async (_req, res) => {
    try {
      const cfg = await getNotionConfig();
      const maskedToken = cfg.token ? `${cfg.token.slice(0, 8)}••••${cfg.token.slice(-4)}` : null;
      return res.json({
        configured: Boolean(cfg.token),
        maskedToken,
        meetingNotesDbId: cfg.meetingNotesDbId,
        studentsDbId: cfg.studentsDbId,
        autoFetchEnabled: cfg.autoFetchEnabled,
        autoFetchIntervalMinutes: cfg.autoFetchIntervalMinutes,
        lastFetchTime: cfg.lastFetchTime,
        lastFetchStatus: cfg.lastFetchStatus,
      });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // 2. POST /api/notion/save-config
  app.post('/api/notion/save-config', requireFirebaseAdmin, async (req, res) => {
    try {
      const { token, meetingNotesDbId, studentsDbId, autoFetchEnabled, autoFetchIntervalMinutes } = req.body;
      const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

      if (typeof token === 'string' && token.trim() !== '') {
        const cleanToken = token.trim().replace(/["']/g, '');
        updates.token = cleanToken;
        process.env.NOTION_API_KEY = cleanToken;
      }
      if (typeof meetingNotesDbId === 'string') {
        const cleanMeeting = normalizeNotionId(meetingNotesDbId);
        updates.meetingNotesDbId = cleanMeeting;
        process.env.NOTION_LESSONS_DB = cleanMeeting;
      }
      if (typeof studentsDbId === 'string') {
        const cleanStudents = normalizeNotionId(studentsDbId);
        updates.studentsDbId = cleanStudents;
        process.env.NOTION_STUDENTS_DB = cleanStudents;
      }
      if (typeof autoFetchEnabled === 'boolean') {
        updates.autoFetchEnabled = autoFetchEnabled;
      }
      if (typeof autoFetchIntervalMinutes === 'number') {
        updates.autoFetchIntervalMinutes = autoFetchIntervalMinutes;
      }

      if (adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection('system').doc('notion').set(updates, { merge: true });
        } catch (e) {
          console.warn('[Notion] Nie udało się zapisać do Firestore (brak uprawnień usługi / fallback lokalny):', e);
        }
      }

      // Persist to local .env file if it exists
      try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, 'utf8');
          if (updates.token) {
            if (content.includes('NOTION_API_KEY=')) {
              content = content.replace(/NOTION_API_KEY=.*(\r?\n|$)/, `NOTION_API_KEY=${updates.token}\n`);
            } else {
              content += `\nNOTION_API_KEY=${updates.token}\n`;
            }
          }
          if (updates.meetingNotesDbId) {
            if (content.includes('NOTION_LESSONS_DB=')) {
              content = content.replace(/NOTION_LESSONS_DB=.*(\r?\n|$)/, `NOTION_LESSONS_DB=${updates.meetingNotesDbId}\n`);
            } else {
              content += `\nNOTION_LESSONS_DB=${updates.meetingNotesDbId}\n`;
            }
          }
          if (updates.studentsDbId) {
            if (content.includes('NOTION_STUDENTS_DB=')) {
              content = content.replace(/NOTION_STUDENTS_DB=.*(\r?\n|$)/, `NOTION_STUDENTS_DB=${updates.studentsDbId}\n`);
            } else {
              content += `\nNOTION_STUDENTS_DB=${updates.studentsDbId}\n`;
            }
          }
          fs.writeFileSync(envPath, content, 'utf8');
        }
      } catch (e) {
        console.warn('[Notion] Nie udało się zapisać konfiguracji do .env:', e);
      }

      const cfg = await getNotionConfig();
      return res.json({
        ok: true,
        message: 'Konfiguracja Notion została pomyślnie zapisana.',
        maskedToken: cfg.token ? `${cfg.token.slice(0, 8)}••••${cfg.token.slice(-4)}` : null,
        meetingNotesDbId: cfg.meetingNotesDbId,
        studentsDbId: cfg.studentsDbId,
        autoFetchEnabled: cfg.autoFetchEnabled,
        autoFetchIntervalMinutes: cfg.autoFetchIntervalMinutes,
      });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // 2b. POST /api/notion/clear-config (Rozłączenie i wyczyszczenie danych)
  app.post('/api/notion/clear-config', requireFirebaseAdmin, async (_req, res) => {
    try {
      process.env.NOTION_API_KEY = '';
      process.env.NOTION_TOKEN = '';
      process.env.NOTION_LESSONS_DB = '';
      process.env.NOTION_STUDENTS_DB = '';

      if (adminApp) {
        try {
          const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
          await adminDb.collection('system').doc('notion').set({
            token: '',
            meetingNotesDbId: '',
            studentsDbId: '',
            autoFetchEnabled: false,
            lastFetchTime: null,
            lastFetchStatus: null,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('[Notion] Nie udało się wyczyścić Firestore:', e);
        }
      }

      try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, 'utf8');
          content = content.replace(/NOTION_API_KEY=.*(\r?\n|$)/, `NOTION_API_KEY=\n`);
          content = content.replace(/NOTION_LESSONS_DB=.*(\r?\n|$)/, `NOTION_LESSONS_DB=\n`);
          content = content.replace(/NOTION_STUDENTS_DB=.*(\r?\n|$)/, `NOTION_STUDENTS_DB=\n`);
          fs.writeFileSync(envPath, content, 'utf8');
        }
      } catch {}

      return res.json({
        ok: true,
        message: 'Konfiguracja Notion została całkowicie wyczyszczona, a połączenie przerwane.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // 2c. POST /api/notion/search-databases (Automatyczne wyszukiwanie baz w Notion)
  app.post('/api/notion/search-databases', requireFirebaseAdmin, async (req, res) => {
    try {
      const cfg = await getNotionConfig();
      let rawToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (rawToken) {
        rawToken = rawToken.replace(/["']/g, '').trim();
      }
      const token = rawToken || cfg.token;

      if (!token) {
        return res.status(400).json({
          error: 'Brak tokena Notion API. Wprowadź token integracji (zaczynający się od "ntn_" lub "secret_"), aby przeszukać udostępnione bazy.',
        });
      }

      const NOTION_API = 'https://api.notion.com/v1';
      const NOTION_VERSION = '2022-06-28';

      const allDatabases: any[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;
      let iterations = 0;

      while (hasMore && iterations < 3) {
        iterations++;
        const requestBody: any = {
          filter: {
            value: 'database',
            property: 'object',
          },
          page_size: 100,
        };
        if (cursor) {
          requestBody.start_cursor = cursor;
        }

        const searchRes = await fetch(`${NOTION_API}/search`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!searchRes.ok) {
          const errText = await searchRes.text();
          let userMsg = `Błąd Notion API (${searchRes.status})`;
          if (searchRes.status === 401) {
            userMsg = 'Nieprawidłowy token Notion (Unauthorized). Upewnij się, że token jest poprawny i nie został unieważniony w panelu integracji Notion.';
          } else if (searchRes.status === 403) {
            userMsg = 'Brak uprawnień do przestrzeni roboczej Notion (Forbidden). Sprawdź uprawnienia integracji.';
          } else {
            userMsg += `: ${errText.slice(0, 200)}`;
          }
          return res.status(searchRes.status).json({ error: userMsg });
        }

        const searchData: any = await searchRes.json();
        const rawResults = searchData.results || [];

        for (const db of rawResults) {
          const title = (db.title || []).map((t: any) => t.plain_text || '').join('').trim() || 'Baza bez tytułu';
          const description = (db.description || []).map((d: any) => d.plain_text || '').join('').trim();
          const icon = db.icon?.emoji || db.icon?.external?.url || null;
          const properties = Object.keys(db.properties || {});
          allDatabases.push({
            id: db.id,
            title,
            description,
            icon,
            url: db.url || `https://notion.so/${db.id.replace(/-/g, '')}`,
            lastEditedTime: db.last_edited_time || db.created_time || null,
            properties,
          });
        }

        hasMore = Boolean(searchData.has_more && searchData.next_cursor);
        cursor = searchData.next_cursor;
      }

      return res.json({
        ok: true,
        count: allDatabases.length,
        databases: allDatabases,
      });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // 3. POST /api/notion/test-connection
  app.post('/api/notion/test-connection', requireFirebaseAdmin, async (req, res) => {
    try {
      const cfg = await getNotionConfig();
      let rawToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (rawToken) {
        rawToken = rawToken.replace(/["']/g, '').trim();
      }
      const token = rawToken || cfg.token;
      const meetingNotesDbId = normalizeNotionId((typeof req.body?.meetingNotesDbId === 'string' && req.body.meetingNotesDbId.trim()) || cfg.meetingNotesDbId);
      const studentsDbId = normalizeNotionId((typeof req.body?.studentsDbId === 'string' && req.body.studentsDbId.trim()) || cfg.studentsDbId);

      if (!token) {
        return res.status(400).json({ error: 'Brak tokena Notion API. Wprowadź token integracji (np. zaczynający się od "ntn_" lub "secret_").' });
      }

      const NOTION_API = 'https://api.notion.com/v1';
      const NOTION_VERSION = '2022-06-28';

      // 1. Sprawdź tożsamość bota
      const userRes = await fetch(`${NOTION_API}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
        },
      });

      if (!userRes.ok) {
        const errText = await userRes.text();
        return res.status(400).json({
          error: `Błąd uwierzytelnienia w Notion API (${userRes.status}): ${errText.slice(0, 200)}`,
        });
      }

      const botData: any = await userRes.json();
      const botName = botData?.name || 'Cribro Notion Integration';
      const workspaceName = botData?.bot?.owner?.workspace_name || 'Notion Workspace';

      // 2. Sprawdź dostęp do bazy transkrypcji spotkań
      let meetingDbTitle = 'Nie skonfigurowano';
      if (meetingNotesDbId) {
        try {
          const dbRes = await fetch(`${NOTION_API}/databases/${meetingNotesDbId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
            },
          });
          if (dbRes.ok) {
            const dbData: any = await dbRes.json();
            meetingDbTitle = (dbData?.title || []).map((t: any) => t.plain_text || '').join('') || 'Baza spotkań';
          } else {
            meetingDbTitle = `Uwaga: brak dostępu lub baza nieudostępniona (${dbRes.status})`;
          }
        } catch (e: any) {
          meetingDbTitle = `Błąd zapytania bazy: ${e.message}`;
        }
      }

      // 3. Sprawdź dostęp do bazy kursantów
      let studentsDbTitle = 'Nie skonfigurowano';
      if (studentsDbId) {
        try {
          const sdbRes = await fetch(`${NOTION_API}/databases/${studentsDbId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
            },
          });
          if (sdbRes.ok) {
            const sdbData: any = await sdbRes.json();
            studentsDbTitle = (sdbData?.title || []).map((t: any) => t.plain_text || '').join('') || 'Baza kursantów';
          } else {
            studentsDbTitle = `Uwaga: brak dostępu lub baza nieudostępniona (${sdbRes.status})`;
          }
        } catch (e: any) {
          studentsDbTitle = `Błąd zapytania bazy: ${e.message}`;
        }
      }

      return res.json({
        ok: true,
        botName,
        workspaceName,
        meetingDbTitle,
        studentsDbTitle,
        message: `Połączenie z Notion udane! Bot "${botName}" w workspace "${workspaceName}".`,
      });
    } catch (err: any) {
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  /**
   * Sprawdza transkrypcje w Notion — wyłącznie na żądanie lektora (Pull-on-Demand).
   *
   * ══ DLACZEGO DWA TRYBY ══
   *
   * `mode: 'preview'` tylko PATRZY: dopasowuje strony Notion do kursantów i
   * zwraca listę kandydatów, nic nie zapisując. `mode: 'import'` zapisuje
   * WYŁĄCZNIE strony, których `id` znalazło się w `pageIds` — czyli te, które
   * lektor jawnie zaakceptował w modalu podglądu. Bez trybu podglądu każde
   * kliknięcie przycisku od razu zapisywało wszystko, co dopasował algorytm,
   * bez możliwości odrzucenia pomyłki przed zapisem.
   *
   * ══ TWARDA DEDUPLIKACJA PO DACIE ══
   *
   * Zanim cokolwiek zapiszemy, sprawdzamy czy dla tego kursanta na ten sam
   * dzień (`YYYY-MM-DD`) istnieje już lekcja ze statusem `confirmed` (czyli
   * odbyta i zatwierdzona). Jeśli tak — pomijamy wpis całkowicie, nie tworząc
   * szkicu do przejrzenia. Lektor nie prowadzi dwóch lekcji z tym samym
   * kursantem jednego dnia, więc druga strona Notion z tą samą datą to prawie
   * zawsze albo już przetworzony wpis, albo poprawka w Notion — obie sytuacje
   * lektor i tak zobaczy w podglądzie jako „już zaimportowano".
   *
   * ══ IDEMPOTENTNE ID ══
   *
   * Dokument lekcji dostaje ID `notion_<pageId>` zamiast losowego — ponowny
   * import tej samej strony nadpisuje ten sam dokument zamiast dokładać
   * bliźniaka. Stare wpisy (sprzed tej zmiany) miały gołe `pageId` jako ID;
   * jeśli taki dokument już istnieje, aktualizujemy JEGO, żeby nie powstał
   * duplikat pod nowym schematem ID obok starego wpisu.
   *
   * ══ CO SIĘ ZMIENIŁO WZGLĘDEM POPRZEDNIEJ WERSJI ══
   *
   * Poprzednia wersja pisała lekcję RÓWNIEŻ do osobnej kolekcji najwyższego
   * poziomu `lessonRecords` (obok właściwej `users/{uid}/lessonRecords`) —
   * ta kolekcja nie miała żadnej reguły w `firestore.rules` (efektywnie
   * zamknięta) i nikt jej nigdy nie czytał ani nie kasował, więc zostawiała
   * osierocone dokumenty przy każdym imporcie. Zapis idzie teraz wyłącznie
   * do `users/{studentId}/lessonRecords`, czyli tego samego miejsca, które
   * czyta i kasuje reszta aplikacji.
   */
  interface NotionTranscriptExtraction {
    topic: string;
    date: string;
    summary: string;
    keyLanguage: Array<{ phrase: string; translation: string; context: string }>;
    corrections: Array<{ original: string; correction: string; rule: string }>;
  }

  const EMPTY_NOTION_EXTRACTION: NotionTranscriptExtraction = {
    topic: '', date: '', summary: '', keyLanguage: [], corrections: [],
  };

  // Ekstrakcja Gemini Flash dla pojedynczej transkrypcji Notion — wywoływana
  // zarówno w podglądzie (żeby lektor zobaczył realny temat/podsumowanie
  // przed importem), jak i przy samym imporcie zaznaczonych stron (koszt
  // pomijalny, bo dotyczy tylko kilku zaznaczonych stron, nie całej listy).
  async function extractNotionTranscriptData(
    transcriptText: string,
    fallbackDate: string,
  ): Promise<NotionTranscriptExtraction> {
    try {
      const apiKey = getGeminiApiKey();
      const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy' });

      const schema = {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING, description: 'Zwięzły, merytoryczny temat lekcji po angielsku (max 6-8 słów)' },
          date: { type: Type.STRING, description: 'Rzeczywista data spotkania w formacie YYYY-MM-DD, jeśli pada w transkrypcji' },
          summary: { type: Type.STRING, description: '2-3 zdania podsumowania po polsku o czym była lekcja' },
          keyLanguage: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                translation: { type: Type.STRING },
                context: { type: Type.STRING },
              },
              required: ['phrase', 'translation'],
            },
          },
          corrections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                correction: { type: Type.STRING },
                rule: { type: Type.STRING },
              },
              required: ['original', 'correction'],
            },
          },
        },
        required: ['topic', 'summary', 'keyLanguage', 'corrections'],
      };

      const response = await generateContentWithRetry(ai, transcriptText.slice(0, 20000), {
        systemInstruction: 'Jesteś asystentem lektora angielskiego. Na podstawie transkrypcji lekcji wyodrębnij temat, datę (jeśli pada wprost), zwięzłe podsumowanie po polsku, nowe słownictwo/zwroty oraz poprawki błędów kursanta. Zwróć wyłącznie JSON zgodny ze schematem.',
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 0 },
      });

      const text = response?.text;
      if (!text) return { ...EMPTY_NOTION_EXTRACTION, date: fallbackDate };

      const json = JSON.parse(text);
      return {
        topic: typeof json.topic === 'string' ? json.topic.trim() : '',
        date: typeof json.date === 'string' && json.date.trim() ? json.date.trim() : fallbackDate,
        summary: typeof json.summary === 'string' ? json.summary.trim() : '',
        keyLanguage: Array.isArray(json.keyLanguage) ? json.keyLanguage : [],
        corrections: Array.isArray(json.corrections) ? json.corrections : [],
      };
    } catch (err) {
      console.error('[Notion Gemini Extraction Error]:', err);
      return { ...EMPTY_NOTION_EXTRACTION, date: fallbackDate };
    }
  }

  async function syncNotionTranscriptsFromApi(
    options: { mode: 'preview' | 'import'; studentId?: string; pageIds?: string[]; topicOverrides?: Record<string, string> }
  ): Promise<{ found: number; processed: number; importedCount?: number; items: any[]; unmatchedTranscripts?: any[]; lastFetchTime: string }> {
    const { mode, studentId: studentIdFilter, pageIds, topicOverrides } = options;
    const allowedPageIds = mode === 'import' ? new Set(pageIds || []) : null;

    const cfg = await getNotionConfig();
    const token = cfg.token;
    const meetingNotesDbId = normalizeNotionId(cfg.meetingNotesDbId);

    if (!token || !meetingNotesDbId || !adminApp) {
      return { found: 0, processed: 0, importedCount: 0, items: [], unmatchedTranscripts: [], lastFetchTime: new Date().toISOString() };
    }

    const NOTION_API = 'https://api.notion.com/v1';
    const NOTION_VERSION = '2022-06-28';
    const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

    // 1. Pobierz użytkowników z Firestore do dopasowywania
    const usersSnap = await adminDb.collection('users').get();
    const userList = usersSnap.docs.map(d => {
      const u = d.data();
      const fullName = (u.firstName || u.lastName) ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username || '';
      return {
        id: d.id,
        name: fullName,
        email: u.email || '',
        isGroup: Boolean(u.isGroup || u.role === 'group'),
        memberIds: u.memberIds || [],
        level: u.level || '',
      };
    });

    // 2. Zapytaj bazę spotkań w Notion o ostatnie strony.
    // Sortowanie po created_time malejąco jest tu konieczne: bez niego Notion
    // zwraca strony w kolejności nieokreślonej, więc przy bazie większej niż
    // page_size świeżo dodana dzisiejsza transkrypcja mogła nie zmieścić się
    // w pierwszych 40 wynikach i modal pokazywał "Brak stron w Notion
    // powiązanych z tym kursantem", mimo że strona istniała.
    console.log('[Notion Fetch] Zapytanie do bazy', { databaseId: meetingNotesDbId, mode, studentIdFilter: studentIdFilter || null, pageSize: 40 });
    const queryRes = await fetch(`${NOTION_API}/databases/${meetingNotesDbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 40,
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      }),
    });

    if (!queryRes.ok) {
      const errTxt = await queryRes.text();
      console.error('[Notion Fetch] Błąd zapytania Notion', queryRes.status, errTxt.slice(0, 300));
      throw new Error(`Błąd zapytania bazy Notion (${queryRes.status}): ${errTxt.slice(0, 300)}`);
    }

    const queryData: any = await queryRes.json();
    const pages = queryData.results || [];
    console.log('[Notion Fetch] Zwrócono stron:', pages.length);
    const processedItems: Array<{
      id: string; title: string; studentName: string; date: string; status: string;
      aiTopic?: string; aiDate?: string; aiSummary?: string;
      keyLanguageCount?: number; correctionsCount?: number;
      keyLanguage?: NotionTranscriptExtraction['keyLanguage'];
      corrections?: NotionTranscriptExtraction['corrections'];
    }> = [];
    const unmatchedTranscripts: Array<{ id: string; title: string; date: string; snippet: string; reason: string }> = [];

    for (const page of pages) {
      const props = page.properties || {};
      let title = '';
      for (const key of Object.keys(props)) {
        if (props[key].type === 'title') {
          title = (props[key].title || []).map((t: any) => t.plain_text || '').join('').trim();
          break;
        }
      }
      if (!title) title = 'Spotkanie bez tytułu';

      let dateStr = '';
      for (const key of Object.keys(props)) {
        if (props[key].type === 'date' && props[key].date?.start) {
          dateStr = props[key].date.start.split('T')[0];
          break;
        }
      }
      if (!dateStr) dateStr = (page.created_time || new Date().toISOString()).split('T')[0];

      // Pobierz pełną treść transkrypcji ze strony
      const transcriptText = await fetchNotionBlocksText(token, page.id, 0);
      if (!transcriptText || transcriptText.length < 50) {
        processedItems.push({
          id: page.id,
          title,
          studentName: 'Brak transkrypcji',
          date: dateStr,
          status: 'pominięto (pusta treść)',
        });
        continue;
      }

      // Logika dopasowania do kursanta / grupy
      let matchedUser: any = null;
      const normTitle = title.toLowerCase();
      const normTranscript = transcriptText.slice(0, 2500).toLowerCase();

      // Dopasowanie do grupy
      for (const u of userList) {
        if (u.isGroup && u.name) {
          if (normTitle.includes(u.name.toLowerCase()) || normTranscript.includes(u.name.toLowerCase())) {
            matchedUser = u;
            break;
          }
        }
      }

      // Dopasowanie po emailu
      if (!matchedUser) {
        for (const u of userList) {
          if (u.email && (normTitle.includes(u.email.toLowerCase()) || normTranscript.includes(u.email.toLowerCase()))) {
            matchedUser = u;
            break;
          }
        }
      }

      // Dopasowanie po pełnym imieniu i nazwisku
      if (!matchedUser) {
        for (const u of userList) {
          if (u.name && u.name.length > 4) {
            const parts = u.name.toLowerCase().split(/\s+/).filter((p: string) => p.length > 2);
            if (parts.length >= 2 && (normTitle.includes(parts.join(' ')) || normTranscript.includes(parts.join(' ')))) {
              matchedUser = u;
              break;
            }
          }
        }
      }

      // Dopasowanie po pierwszym imieniu
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

      // Dopasowanie po samym nazwisku — tytuły stron Notion bywają nadane
      // przez narzędzie do nagrywania spotkań i nie zawsze zaczynają się od
      // imienia (np. tylko nazwisko albo "spotkanie z p. Wach").
      if (!matchedUser) {
        for (const u of userList) {
          if (u.name) {
            const nameParts = u.name.toLowerCase().split(/\s+/).filter((p: string) => p.length > 2);
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            if (lastName && lastName.length >= 3 && (normTitle.includes(lastName) || normTranscript.includes(lastName))) {
              matchedUser = u;
              break;
            }
          }
        }
      }

      if (!matchedUser) {
        console.log('[Notion Fetch] Brak dopasowania kursanta dla strony', { pageId: page.id, title });
      }

      // Jeśli transkrypcja nie pasuje do żadnego kursanta w bazie (np. spotkanie prywatne/inne):
      if (!matchedUser) {
        // Podgląd zawężony do jednego kursanta nie pokazuje cudzych, niedopasowanych stron.
        if (studentIdFilter) continue;
        unmatchedTranscripts.push({
          id: page.id,
          title,
          date: dateStr,
          snippet: transcriptText.slice(0, 200).replace(/\s+/g, ' ').trim(),
          reason: 'Nie dopasowano do żadnego kursanta ani grupy w bazie (spotkanie poza zajęciami)',
        });
        processedItems.push({
          id: page.id,
          title,
          studentName: 'Brak dopasowania (zignorowano)',
          date: dateStr,
          status: 'zignorowano (brak powiązania z kursantem)',
        });
        continue;
      }

      const studentId = matchedUser.id;
      const studentName = matchedUser.name || title.split(/[\-\–—:]/)[0].trim() || 'Kursant';

      // Pull-on-Demand: podgląd patrzy tylko na wybranego kursanta, jeśli
      // lektor go zaznaczył — strony innych kursantów nie zaśmiecają listy.
      if (studentIdFilter && studentId !== studentIdFilter) {
        continue;
      }

      const lessonsRef = adminDb.collection('users').doc(studentId).collection('lessonRecords');

      // Ta strona Notion już tu jest — bez względu na to, pod jakim ID (stare
      // wpisy sprzed idempotentnego ID miały gołe `pageId`, nowe mają
      // `notion_<pageId>`; szukamy po polu, nie po ID dokumentu).
      const alreadyImportedSnap = await lessonsRef.where('notionPageId', '==', page.id).limit(1).get();
      if (!alreadyImportedSnap.empty) {
        processedItems.push({ id: page.id, title, studentName, date: dateStr, status: 'istnieje' });
        continue;
      }

      // Twarda deduplikacja po dacie: kursant nie ma dwóch odbytych lekcji
      // tego samego dnia. Jeśli już jedna jest zatwierdzona na ten dzień,
      // druga strona z Notion to niemal zawsze powtórka albo poprawka w
      // Notion — nie tworzymy dla niej szkicu.
      const sameDayConfirmedSnap = await lessonsRef
        .where('date', '==', dateStr)
        .where('status', '==', 'confirmed')
        .limit(1)
        .get();
      if (!sameDayConfirmedSnap.empty) {
        processedItems.push({
          id: page.id,
          title,
          studentName,
          date: dateStr,
          status: 'pominięto (kursant ma już zatwierdzoną lekcję na ten dzień)',
        });
        continue;
      }

      // Tytuł strony Notion bywa nadany przez narzędzie do nagrywania spotkań
      // i wygląda np. "Milena Sesniak - 2026-09-16T06:30:00.000Z" — surowy
      // znacznik czasu ISO doklejony do imienia, a nie prawdziwy temat lekcji.
      // Zapisanie go wprost jako `topic` wygląda w UI lektora jak zepsuty rekord.
      const safeTopic = isJunkIsoTopic(title)
        ? `Lekcja z dnia ${formatLessonDateDDMMYYYY(dateStr) || dateStr}`
        : title;

      if (mode === 'preview') {
        // Ekstrakcja AI już na etapie podglądu — lektor ma zobaczyć realny
        // temat i podsumowanie zanim cokolwiek zaakceptuje, nie surowy tytuł
        // strony Notion czy gołą datę ISO.
        const extraction = await extractNotionTranscriptData(transcriptText, dateStr);
        processedItems.push({
          id: page.id,
          title,
          studentName,
          date: dateStr,
          status: 'do importu',
          aiTopic: extraction.topic || safeTopic,
          aiDate: extraction.date || dateStr,
          aiSummary: extraction.summary,
          keyLanguageCount: extraction.keyLanguage.length,
          correctionsCount: extraction.corrections.length,
          keyLanguage: extraction.keyLanguage,
          corrections: extraction.corrections,
        });
        continue;
      }

      // mode === 'import': zapisujemy wyłącznie to, co lektor jawnie zaznaczył
      // w modalu podglądu — nie wszystko, co akurat dopasował algorytm.
      if (!allowedPageIds!.has(page.id)) {
        processedItems.push({ id: page.id, title, studentName, date: dateStr, status: 'pominięto (nie zaznaczono)' });
        continue;
      }

      // Ponowna ekstrakcja tylko dla zaznaczonych stron — modal podglądu
      // jest jedynym krokiem potwierdzenia, więc lekcja trafia do Firestore
      // od razu kompletna (temat/data/podsumowanie/słownictwo/korekty),
      // bez osobnego etapu "wygeneruj bloki i potwierdź" jak wcześniej.
      const extraction = await extractNotionTranscriptData(transcriptText, dateStr);
      const finalTopic = (topicOverrides?.[page.id]?.trim()) || extraction.topic || safeTopic;
      const finalDate = extraction.date || dateStr;

      const vocabularyText = extraction.keyLanguage
        .map((item) => `${item.phrase} - ${item.translation}${item.context ? `\n"${item.context}"` : ''}`)
        .join('\n');
      const corrections = extraction.corrections
        .map((item) => `❌ ${item.original} → ✅ ${item.correction}${item.rule ? `\n${item.rule}` : ''}`)
        .join('\n');

      const lessonPayload = {
        studentId,
        studentIds: matchedUser.isGroup && matchedUser.memberIds?.length ? matchedUser.memberIds : [studentId],
        studentName,
        date: finalDate,
        topic: finalTopic,
        lessonSummary: extraction.summary,
        vocabularyText,
        corrections,
        rawTranscript: transcriptText,
        liveTranscript: transcriptText,
        notionPageId: page.id,
        source: 'notion',
        isGroupLesson: Boolean(matchedUser.isGroup),
        sessionStatus: 'completed',
        status: 'confirmed',
        isPendingConfirmation: false,
        isDateMissing: false,
        pendingReason: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ID idempotentne: ponowny import tej samej strony nadpisuje ten sam
      // dokument zamiast dokładać bliźniaka.
      await lessonsRef.doc(`notion_${page.id}`).set(lessonPayload, { merge: true });

      processedItems.push({ id: page.id, title, studentName, date: finalDate, status: 'zaimportowano' });
    }

    const nowIso = new Date().toISOString();
    await adminDb.collection('system').doc('notion').set({
      lastFetchTime: nowIso,
      lastFetchStatus: `Przetworzono ${processedItems.length} stron z Notion (${unmatchedTranscripts.length} zignorowano)`,
    }, { merge: true });

    return {
      found: pages.length,
      processed: processedItems.length,
      importedCount: processedItems.filter(p => p.status === 'zaimportowano').length,
      items: processedItems,
      unmatchedTranscripts,
      lastFetchTime: nowIso,
    };
  }

  // 4. POST /api/notion/fetch-transcripts — Pull-on-Demand: podgląd (bez zapisu)
  // albo import ograniczony do jawnie zaznaczonych stron dla jednego kursanta.
  // Body: { mode: 'preview' | 'import', studentId?: string, pageIds?: string[], topicOverrides?: Record<string,string> }
  app.post('/api/notion/fetch-transcripts', requireFirebaseAdmin, async (req, res) => {
    try {
      const mode = req.body?.mode === 'import' ? 'import' : 'preview';
      const studentId = typeof req.body?.studentId === 'string' && req.body.studentId ? req.body.studentId : undefined;
      const pageIds = Array.isArray(req.body?.pageIds) ? req.body.pageIds.filter((id: unknown) => typeof id === 'string') : [];
      const topicOverrides: Record<string, string> | undefined = req.body?.topicOverrides && typeof req.body.topicOverrides === 'object'
        ? Object.fromEntries(Object.entries(req.body.topicOverrides).filter(([, v]) => typeof v === 'string') as [string, string][])
        : undefined;

      if (mode === 'import' && (!studentId || pageIds.length === 0)) {
        return res.status(400).json({ error: 'Import wymaga wybranego kursanta i przynajmniej jednej zaznaczonej strony.' });
      }

      const result = await syncNotionTranscriptsFromApi({ mode, studentId, pageIds, topicOverrides });
      return res.json({
        ok: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[Notion Fetch Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // 5. GET /api/notion/recent-meetings — pobieranie spotkań z bazy Notion z ostatnich 7 dni
  app.get('/api/notion/recent-meetings', requireFirebaseAdmin, async (_req, res) => {
    try {
      const cfg = await getNotionConfig();
      const token = cfg.token;
      const meetingNotesDbId = normalizeNotionId(cfg.meetingNotesDbId);

      if (!token || !meetingNotesDbId) {
        return res.json({
          ok: true,
          configured: false,
          meetings: [],
          message: 'Baza spotkań Notion nie jest jeszcze skonfigurowana.',
        });
      }

      const NOTION_API = 'https://api.notion.com/v1';
      const NOTION_VERSION = '2022-06-28';

      // 7 dni wstecz
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();

      // Zapytaj bazę Notion z sortowaniem malejącym i ewentualnym filtrem daty
      const queryRes = await fetch(`${NOTION_API}/databases/${meetingNotesDbId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_size: 50,
          sorts: [
            {
              timestamp: 'created_time',
              direction: 'descending',
            },
          ],
        }),
      });

      if (!queryRes.ok) {
        const errTxt = await queryRes.text();
        return res.status(queryRes.status).json({
          error: `Błąd odpytywania bazy Notion (${queryRes.status}): ${errTxt.slice(0, 250)}`,
        });
      }

      const queryData: any = await queryRes.json();
      const pages = queryData.results || [];
      const meetings: Array<{
        id: string;
        title: string;
        studentNameRaw: string;
        lessonDate: string;
        url: string;
        createdTime: string;
      }> = [];

      for (const page of pages) {
        const props = page.properties || {};

        // 1. Tytuł spotkania
        let title = '';
        for (const key of Object.keys(props)) {
          if (props[key].type === 'title') {
            title = (props[key].title || []).map((t: any) => t.plain_text || '').join('').trim();
            break;
          }
        }
        if (!title) title = 'Spotkanie bez tytułu';

        // 2. Kursant (właściwość "Kursant" lub powiązana relacja/tekst/select)
        let studentNameRaw = '';
        for (const key of Object.keys(props)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('kursant') || lowerKey.includes('student') || lowerKey.includes('uczeń') || lowerKey.includes('klient')) {
            const prop = props[key];
            if (prop.type === 'rich_text') {
              studentNameRaw = (prop.rich_text || []).map((t: any) => t.plain_text || '').join('').trim();
            } else if (prop.type === 'title') {
              studentNameRaw = (prop.title || []).map((t: any) => t.plain_text || '').join('').trim();
            } else if (prop.type === 'select' && prop.select?.name) {
              studentNameRaw = prop.select.name.trim();
            } else if (prop.type === 'people' && prop.people?.length > 0) {
              studentNameRaw = prop.people.map((p: any) => p.name || p.person?.email || '').filter(Boolean).join(', ');
            } else if (prop.type === 'relation' && prop.relation?.length > 0) {
              studentNameRaw = 'Relacja do kursanta';
            }
            if (studentNameRaw) break;
          }
        }

        // Jeśli brak osobnej właściwości "Kursant", spróbuj wyciągnąć imię/nazwisko z początku tytułu
        if (!studentNameRaw && title) {
          const cleanFromTitle = title.split(/[@–—\-:(]/)[0].trim();
          if (cleanFromTitle && cleanFromTitle.length >= 3) {
            studentNameRaw = cleanFromTitle;
          }
        }

        // 3. Data zajęć (właściwość "Data zajęć", "Data" lub created_time)
        let lessonDate = '';
        for (const key of Object.keys(props)) {
          const lowerKey = key.toLowerCase();
          if (props[key].type === 'date' && props[key].date?.start) {
            lessonDate = props[key].date.start.split('T')[0];
            if (lowerKey.includes('zajęć') || lowerKey.includes('lekcj') || lowerKey.includes('data')) {
              break;
            }
          }
        }
        if (!lessonDate) {
          lessonDate = (page.created_time || new Date().toISOString()).split('T')[0];
        }

        // Filtruj spotkania z ostatnich 7-10 dni (lub wszystkie najświeższe do limitu)
        const pageDateObj = new Date(lessonDate || page.created_time);
        const isRecent = isNaN(pageDateObj.getTime()) || (Date.now() - pageDateObj.getTime()) <= 10 * 24 * 60 * 60 * 1000;

        if (isRecent || meetings.length < 15) {
          meetings.push({
            id: page.id,
            title,
            studentNameRaw,
            lessonDate,
            url: page.url || `https://notion.so/${page.id.replace(/-/g, '')}`,
            createdTime: page.created_time,
          });
        }
      }

      return res.json({
        ok: true,
        configured: true,
        meetings,
      });
    } catch (err: any) {
      console.error('[Notion Recent Meetings Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // 6. GET /api/notion/meeting-content/:pageId — pobieranie scalonej treści bloków notatek/transkrypcji
  app.get('/api/notion/meeting-content/:pageId', requireFirebaseAdmin, async (req, res) => {
    try {
      const pageId = String(req.params.pageId || '').trim();
      if (!pageId) {
        return res.status(400).json({ error: 'Brak identyfikatora strony Notion (pageId).' });
      }

      const cfg = await getNotionConfig();
      const token = cfg.token;
      if (!token) {
        return res.status(400).json({ error: 'Brak skonfigurowanego tokena Notion API.' });
      }

      const content = await fetchNotionBlocksText(token, pageId, 0);
      return res.json({
        ok: true,
        pageId,
        content: content || '',
        length: content ? content.length : 0,
      });
    } catch (err: any) {
      console.error('[Notion Meeting Content Error]:', err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Zadanie w tle, które co 5 minut samo odpytywało Notion, zostało usunięte
  // (zlecenie 2026-09-21: import z Notion ma działać wyłącznie na kliknięcie
  // lektora — patrz `syncNotionTranscriptsFromApi` i /api/notion/fetch-transcripts
  // wyżej). Pola `autoFetchEnabled`/`autoFetchIntervalMinutes` w `getNotionConfig()`
  // zostają nieużywane w kodzie — jedyny ich sens to historyczne dane w
  // `system/notion`, którym nic już nie nadaje znaczenia.

  // Proxy for Gemini API
  
  
app.post('/api/gemini/generate-test', requireFirebaseAdmin, async (req, res) => {
    try {
      const { level, testTitle, scope, studentProfile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, typeCounts, fileData, driveFile } = req.body;
      const apiKey = getGeminiApiKey();
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      
      let typeBreakdownInstruction = '';
      if (typeCounts && typeof typeCounts === 'object' && Object.keys(typeCounts).length > 0) {
        const parts = Object.entries(typeCounts)
          .filter(([t]) => !selectedTypes || selectedTypes.includes(t))
          .map(([type, count]) => `- ${type}: DOKŁADNIE 1 ZADANIE ZBIORCZE zawierające ${count} przykładów/zdań w bullet pointach`);
        if (parts.length > 0) {
          typeBreakdownInstruction = `STRUKTURA ZADAŃ W TESTU (GŁÓWNA ZASADA GRUPOWANIA):\n${parts.join('\n')}\nKażdy z wybranych typów ma stanowić DOKŁADNIE JEDNO POJEDYNCZE ZADANIE ZBIORCZE z wybraną liczbą przykładów! Łączna liczba obiektów w tablicy pytań ma wynosić DOKŁADNIE ${selectedTypes ? selectedTypes.length : 1} (po jednym obiekcie dla każdego wybranego typu).`;
        }
      }

      
      // Reguły typów i kontrola języka mieszkają w utils/testExerciseRules.ts —
      // razem z walidacją, która sprawdza wynik zamiast ufać instrukcji.
      const activeTypes = selectedTypes || ['multiple_choice', 'fill_in_blank', 'fill_in_blank_bank', 'translation'];
      const activeRules = rulesForTypes(activeTypes);

      let contents = [];
      const prompt = `Jesteś asystentem edukacyjnym, generatorem testów opartym o zaawansowany model.
Twoim zadaniem jest przygotowanie wysoce spersonalizowanego testu dla kursanta, analizując jego historię lekcji.

${LANGUAGE_IRON_RULE}

# KLUCZOWA ZASADA STRUKTURALNA (POJEDYNCZE ZADANIE ZBIORCZE DLA KAŻDEGO TYPU ĆWICZENIA):
Dla każdego wybranego typu zadania (np. 'translation', 'fill_in_blank', 'matching' itp.) twórz **TYLKO JEDNO DANE ZADANIE ZBIORCZE** (jeden obiekt w tablicy JSON).
Wszystkie podane przykłady/zdania dla danego typu umieść WEWNĄTRZ tego jednego zadania (np. w polu 'prompt' jako wypunktowana/numerowana lista w bullet pointach 1., 2., 3., 4... lub w 'options' w przypadku łączenia w pary).
Nie twórz osobnych obiektów zadań dla każdego zdania!

Przykład: Jeśli nauczyciel wybrał 'translation' i liczbę przykładów 4:
Tworzysz 1 obiekt typu 'translation':
- instruction: "Przetłumacz poniższe zdania na język angielski:"
- prompt: "1. Pierwsze zdanie po polsku.\n2. Drugie zdanie po polsku.\n3. Trzecie zdanie po polsku.\n4. Czwarte zdanie po polsku."
- correctAnswer: "1. First sentence.\n2. Second sentence.\n3. Third sentence.\n4. Fourth sentence."

# ZASADY ŻELAZNE:
1. Przeanalizuj dokładnie profil kursanta:
${studentProfile}
Oraz CAŁĄ historię jego lekcji:
${allLessonsContext}

2. Test musi być ściśle dostosowany do poziomu kursanta: ${level}.
3. Oprzyj merytorykę zadań GŁÓWNIE na wybranych lekcjach stanowiących kontekst bieżącego materiału:
${lessonContext}
4. Wygeneruj DOKŁADNIE ${selectedTypes ? selectedTypes.length : 1} obiektów zadań w tablicy wynikowej (po 1 zbiorczym zadaniu na każdy typ):
${typeBreakdownInstruction}

5. Użyj TYLKO następujących typów zadań wybranych przez nauczyciela: ${selectedTypes ? selectedTypes.join(', ') : 'multiple_choice, fill_in_blank, fill_in_blank_bank, translation'}.
   ZABRANIA SIĘ TWORZENIA ZADAŃ INNEGO TYPU. Jeśli dany typ nie został wymieniony na liście powyżej, NIE MOŻE pojawić się w teście!
   Zasady dla typów zadań zbiorczych:
   ${activeRules}
   
   JĘZYK I STYL ZDAŃ:
   Wszystkie wygenerowane zdania, teksty i historyjki muszą być w 100% naturalne i oparte na autentycznych materiałach, przerobionych z kursantem.
   Unikaj "pokręconych", sztucznych i fikcyjnych konstrukcji. Pisz tak, jak rozmawiają ludzie. Zastosuj się ściśle do przesłanego kontekstu lekcji.

   SPÓJNOŚĆ LOGICZNO-SEMANTYCZNA — ZASADY ROZSTRZYGAJĄCE:
   a) SENS PRZED SŁOWNICTWEM. Każde zdanie ma opisywać sytuację, która mogła się wydarzyć: podmiot musi
      móc wykonać czynność, dopełnienie musi do niej pasować. Zdanie poprawne gramatycznie, ale bezsensowne
      znaczeniowo, jest błędem równie ciężkim jak błąd gramatyczny. Użycie słowa z materiału NIGDY nie
      usprawiedliwia zdania, które nie ma sensu.
   b) JEDNA POPRAWNA ODPOWIEDŹ. Każde zadanie musi mieć dokładnie jedno rozwiązanie. Jeśli w lukę albo w
      tłumaczenie pasuje kilka równie dobrych wariantów, dopisz kontekst zawężający albo przebuduj zadanie —
      inaczej kursant dostanie błąd za poprawną odpowiedź. Dotyczy to zwłaszcza synonimów i zamiennych
      konstrukcji ("I must" / "I have to").
   c) KONTEKST WYSTARCZAJĄCY DO ROZWIĄZANIA. Zadanie ma być rozwiązywalne z samej swojej treści, bez
      zgadywania, co autor miał na myśli. Zdanie z luką musi nieść wskazówkę, która przesądza o odpowiedzi.
   d) SPÓJNOŚĆ WEWNĄTRZ ZADANIA ZBIORCZEGO. Wszystkie punkty (1., 2., 3.) w jednym zadaniu mają trzymać się
      jednego tematu i jednego rejestru — razem mają czytać się jak zestaw z jednej lekcji, a nie jak zdania
      zebrane z różnych podręczników.
   e) DYSTRAKTORY MUSZĄ BYĆ WIARYGODNE. Błędne opcje to typowe pomyłki Polaka: kalka z polskiego, mylony czas,
      zły przyimek, częsty błąd ortograficzny. Opcje absurdalne albo złożone z przypadkowych słów niczego nie
      sprawdzają i są zabronione.
   f) POLSZCZYZNA MA BRZMIEĆ PO POLSKU. Zdania do tłumaczenia i polecenia to zdania, jakie napisałby Polak,
      a nie tłumaczenie słowo w słowo z angielskiego.
   
6. WAŻNE - FORMATOWANIE I BRAK DUBLOWANIA:
   W polu "instruction" zamieść Krótkie Ogólne Polecenie w języku polskim (np. "Przetłumacz poniższe zdania na język angielski:").
   W polu "prompt" umieść właściwe przykłady w punktach 1., 2., 3...
   BEZWZGLĘDNIE KAŻDY PUNKT (1., 2., 3...) W POLU "prompt" ORAZ "correctAnswer" MUSI ZACZYNAĆ SIĘ OD NOWEJ LINII (\n)! ZABRANIA SIĘ UMIESZCZANIA KILKU ZDAŃ W TEJ SAMEJ LINII.
   BEZWZGLĘDNIE ZABRANIA SIĘ POWTARZANIA TREŚCI POLECENIA W POLU PROMPT!

Tytuł testu: ${testTitle}
Zakres materiału: ${scope}
  
Zwróć wynik jako obiekt JSON zawierający tablicę obiektów pytań.`;

      if (driveFile) {
        const url = driveFile.mimeType === 'application/pdf' 
          ? `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media`
          : `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=text/plain`;
          
        const fetchRes = await fetch(url, { headers: { Authorization: `Bearer ${driveFile.token}` } });
        if (!fetchRes.ok) throw new Error("Failed to fetch from Google Drive: " + await fetchRes.text());
        
        if (driveFile.mimeType === 'application/pdf') {
            const arrayBuffer = await fetchRes.arrayBuffer();
            contents = [
              { text: prompt },
              { inlineData: { mimeType: 'application/pdf', data: Buffer.from(arrayBuffer).toString('base64') } }
            ];
        } else {
            const textContent = await fetchRes.text();
            contents = [
              { text: prompt + "\n\n[MATERIAŁ DODATKOWY Z GOOGLE DRIVE]:\n" + textContent }
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
            instruction: { type: Type.STRING, description: "Short instruction in Polish, e.g. \"Uzupełnij luki:\"" },
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
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.4
      });

      /**
       * Lista zadań z odpowiedzi modelu.
       *
       * Kształt zależy od tego, kto odpowiedział: Gemini z `responseSchema`
       * oddaje gołą tablicę, OpenAI w trybie `json_object` — obiekt z tablicą
       * w środku. Wcześniej sprawdzaliśmy tu wyłącznie `Array.isArray`, przez
       * co odpowiedź OpenAI była odrzucana jako niepoprawna, mimo że była
       * poprawna. Szczegóły: utils/modelJsonList.ts.
       */
      const parseQuestions = extractListFromModelJson;

      const draftQuestions = parseQuestions(draftResponse.text);

      // Bez zadań z pierwszego przebiegu nie ma czego weryfikować ani ratować.
      if (!draftQuestions) {
        console.error('Generowanie testu: pierwszy przebieg nie zwrócił poprawnego JSON-a', {
          snippet: (draftResponse.text || '').slice(0, 500)
        });
        return res.status(502).json({
          error: 'Model nie zwrócił poprawnej listy zadań. Spróbuj ponownie lub zmniejsz liczbę zadań.'
        });
      }

      // Krok 2: Weryfikacja spójności logicznej testu
      const verificationPrompt = `Przeanalizuj poniższe wygenerowane zadania testowe w formacie JSON:
${draftResponse.text}

TWOJE ZADANIE: Sprawdź spójność logiczną i sens wygenerowanych pytań. Upewnij się, że zadania i odpowiedzi są naturalne, poprawne merytorycznie i nie zawierają sztucznego, robotycznego języka.
Jeśli to konieczne, popraw treść, aby była w 100% poprawna i praktyczna z punktu widzenia nauczania języka angielskiego.
Zwróć skorygowany wynik WYŁĄCZNIE jako poprawną tablicę JSON, zachowując dokładnie tę samą strukturę.`;

      /**
       * Weryfikacja jest ulepszeniem, nie warunkiem powodzenia.
       *
       * Wcześniej jej wynik nadpisywał `response` bezwarunkowo — wystarczyło,
       * że drugi przebieg uciął długą tablicę albo zwrócił obiekt zamiast
       * listy, a cały wygenerowany test przepadał i lektor dostawał samo
       * „Błąd generowania testu". Teraz nieudana weryfikacja po prostu
       * zostawia wersję z pierwszego przebiegu.
       */
      let parsed: any[] = draftQuestions;
      try {
        const verified = await generateContentWithRetry(ai, [{ text: verificationPrompt }], {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.3
        });
        const verifiedQuestions = parseQuestions(verified.text);
        if (verifiedQuestions) {
          parsed = verifiedQuestions;
        } else {
          console.warn('Generowanie testu: weryfikacja nie zwróciła poprawnej listy — zostaje pierwszy przebieg');
        }
      } catch (verificationError: any) {
        console.warn('Generowanie testu: weryfikacja nie powiodła się — zostaje pierwszy przebieg', {
          error: verificationError?.message || String(verificationError)
        });
      }

      /**
       * Kontrola języka — ostatnia bramka przed oddaniem testu lektorowi.
       *
       * Instrukcja w prompcie to prośba, nie gwarancja. Ta walidacja sprawdza
       * WYNIK: czy tekst z lukami jest po angielsku, czy bank słów nie jest
       * polski, czy tłumaczenie ma polską stronę tam, gdzie trzeba. Jeśli nie,
       * jedna próba naprawy z wypisanymi zarzutami — bo model poinformowany,
       * co zrobił źle, poprawia to w jednym podejściu.
       */
      const languageProblems = validateTestLanguage(parsed);
      if (languageProblems.length > 0) {
        console.warn('Generowanie testu: zła wersja językowa zadań — próbuję naprawić', {
          problems: languageProblems.map((p) => `${p.type}.${p.field}: ${p.found}`),
        });

        const repairPrompt = `${LANGUAGE_IRON_RULE}

Poniższy test został wygenerowany z błędami językowymi:

${JSON.stringify(parsed)}

ZARZUTY:
${describeProblems(languageProblems)}

Popraw WYŁĄCZNIE język wskazanych pól. Zachowaj typy zadań, liczbę zadań, strukturę
i tematykę. Tekst, który ma być po angielsku, przetłumacz lub napisz od nowa po angielsku
tak, żeby ćwiczenie dalej sprawdzało to samo. Zwróć wynik w tej samej strukturze JSON.`;

        try {
          const repaired = await generateContentWithRetry(ai, [{ text: repairPrompt }], {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.2
          });
          const repairedQuestions = parseQuestions(repaired.text);
          if (repairedQuestions && validateTestLanguage(repairedQuestions).length === 0) {
            parsed = repairedQuestions;
            console.log('Generowanie testu: naprawa językowa powiodła się');
          } else {
            // Nie oddajemy lektorowi testu po polsku. Lepiej powiedzieć wprost,
            // co jest nie tak, niż kazać mu to odkrywać na kursancie.
            return res.status(502).json({
              error:
                'Model wygenerował ćwiczenia w złym języku (treść po polsku zamiast po angielsku) ' +
                'i nie poprawił ich po podpowiedzi. Spróbuj ponownie albo zmniejsz liczbę typów zadań.'
            });
          }
        } catch (repairError: any) {
          console.error('Generowanie testu: naprawa językowa nie powiodła się', {
            error: repairError?.message || String(repairError)
          });
          return res.status(502).json({
            error: 'Nie udało się wygenerować ćwiczeń po angielsku. Spróbuj ponownie.'
          });
        }
      }

      // Model mimo instrukcji układa rozsypkę w kolejności luk, przez co słowo
      // do pierwszej luki leży pierwsze i ćwiczenie sprawdza tylko przepisywanie.
      // Tasujemy po stronie serwera, bo to jedyny sposób, który działa zawsze.
      // Ocena porównuje treść, nie pozycję, więc kolejność jest bez znaczenia.
      if (Array.isArray(parsed)) {
        parsed = parsed.map((question: any) =>
          Array.isArray(question?.wordBank) && question.wordBank.length > 1
            ? { ...question, wordBank: shuffleDistinct(question.wordBank) }
            : question
        );
      }

      return res.json({ questions: parsed });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  app.post('/api/gemini/import-lessons-batch', requireFirebaseAdmin, async (req, res) => {
    try {
      const { textContent, pdfBase64, driveFile, students, targetStudentId, targetStudentName } = req.body;
      if (!textContent && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: 'Missing textContent, pdfBase64 or driveFile' });
      }
      
      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) {
        return res.status(500).json({ error: 'AI API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in environment variables.' });
      }
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      
      const studentsListStr = typeof students === 'string' 
        ? students 
        : (Array.isArray(students) 
            ? students.map((s: any) => `ID: ${s.id} | Imię/Nazwisko: ${s.name || s.username || ''} | Poziom: ${s.level || ''} | Opis: ${s.description || ''}`).join('\n')
            : 'Brak bazy kursantów');

      let parsedDocText = textContent || '';
      let isPdfFallbackNeeded = false;

      // Extract text from PDF using pdf-parse if pdfBase64 is provided
      if (pdfBase64) {
        try {
          const rawB64 = pdfBase64.split(',')[1] || pdfBase64;
          const pdfBuffer = Buffer.from(rawB64, 'base64');
          const pdfData = await pdfParse(pdfBuffer);
          if (pdfData && pdfData.text && pdfData.text.trim().length > 10) {
            parsedDocText = (parsedDocText ? parsedDocText + '\n\n' : '') + pdfData.text;
          } else {
            isPdfFallbackNeeded = true;
          }
        } catch (pdfErr) {
          console.warn('pdf-parse failed, falling back to multi-modal PDF upload:', pdfErr);
          isPdfFallbackNeeded = true;
        }
      }

      if (driveFile) {
        try {
          const url = driveFile.mimeType === 'application/pdf' 
            ? `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media`
            : `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=text/plain`;
            
          const driveRes = await fetch(url, { headers: { Authorization: `Bearer ${driveFile.token}` } });
          if (!driveRes.ok) throw new Error("Failed to fetch from Google Drive: " + await driveRes.text());
          
          if (driveFile.mimeType === 'application/pdf') {
            const arrayBuffer = await driveRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            try {
              const drivePdfData = await pdfParse(buffer);
              if (drivePdfData && drivePdfData.text) {
                parsedDocText = (parsedDocText ? parsedDocText + '\n\n' : '') + drivePdfData.text;
              } else {
                isPdfFallbackNeeded = true;
              }
            } catch (e) {
              isPdfFallbackNeeded = true;
            }
          } else {
            const driveText = await driveRes.text();
            parsedDocText = (parsedDocText ? parsedDocText + '\n\n' : '') + driveText;
          }
        } catch (dErr) {
          console.warn('Drive file processing error:', dErr);
        }
      }

      let contents: any[] = [];

      if (isPdfFallbackNeeded && pdfBase64) {
        contents = [{
          role: 'user',
          parts: [
            {
              inlineData: {
                data: pdfBase64.split(',')[1] || pdfBase64,
                mimeType: 'application/pdf'
              }
            },
            { text: `Baza kursantów:\n${studentsListStr}\n\nPrzeanalizuj powyzszy plik PDF z historią lekcji.` }
          ]
        }];
      } else {
        // Transkrypcje z zajęć potrafią mieć setki tysięcy znaków. Model urywa
        // wtedy odpowiedź w połowie JSON-a, a import kończy się błędem parsowania
        // zamiast informacją, że materiał był za długi. Ucinamy świadomie i
        // mówimy o tym w logu, żeby dało się to rozpoznać po fakcie.
        const MAX_SOURCE_CHARS = 120000;
        if (parsedDocText.length > MAX_SOURCE_CHARS) {
          console.warn(
            `[import-lessons-batch] Materiał ma ${parsedDocText.length} znaków — ucinam do ${MAX_SOURCE_CHARS}.`
          );
          parsedDocText = parsedDocText.slice(0, MAX_SOURCE_CHARS);
        }

        contents = [{
          role: 'user',
          parts: [
            { text: `Baza kursantów:\n${studentsListStr}\n\nTreść dokumentu/notatek z historią lekcji:\n${parsedDocText}` }
          ]
        }];
      }

      const sysInstruction = `# Cel
Jesteś precyzyjnym asystentem nauczyciela języka angielskiego. Twoim zadaniem jest przeanalizowanie tekstu/dokumentu zawierającego historię lekcji jednego lub wielu kursantów i wyodrębnienie WYŁĄCZNIE DOKŁADNYCH lekcji w strukturze JSON.

# BARDZO WAŻNE ZASADY ANALIZY I PRZYPISYWANIA:

1. AKTYWNY KURSANT (ZAKŁADKA / PROFIL):
${targetStudentId ? `Głównym kursantem jest: ${targetStudentName || targetStudentId} (ID: "${targetStudentId}"). Jeśli plik zawiera historię lekcji tego kursanta lub nie precyzuje innego konkretnego nazwiska z bazy, KAŻDEJ wyodrębnionej lekcji przypisz ten studentId: "${targetStudentId}".` : 'Dopasuj kursanta na podstawie nazwiska/imienia z dokumentu i podanej bazy.'}

2. NAGŁÓWKI DAT (date):
- PRZEANALIZUJ nagłówki i daty przy każdej lekcji w pliku (np. "12.03.2024", "12 marca 2024", "2024-03-12", "Lekcja z dnia 15/01/2024", "10.05.2023").
- Przekonwertuj każdą datę do standardowego formatu YYYY-MM-DD (np. "2024-03-12").
- BEZWZGLĘDNIE ZACHOWAJ oryginalną datę każdej lekcji z pliku! ZABRONIONE jest zastępowanie istniejącej w pliku daty dzisiejszą datą. Tylko w przypadku całkowitego braku jakiejkolwiek daty w sekcji danej lekcji podaj dzisiejszą datę.

3. NAZWY TEMATÓW LEKCJI (lessonTopic):
- BEZWZGLĘDNA ZASADA: Jeśli w pliku/dokumentach znajduje się nazwa lub temat lekcji (np. "Temat: Rozmowa kwalifikacyjna", "Topic: Present Perfect vs Past Simple", "Grammar: First Conditional", "Business English: Negotiations"), UŻYJ DOKŁADNIE TEJ NAZWY TEMATU Z PLIKU!
- NIE WYMYŚLAJ nowych nazw tematów, NIE PARAFRAZUJ ani NIE MODYFIKUJ nazwy tematu, jeśli jest ona podana w pliku!
- Twórz/generuj nazwę tematu TYLKO WTEDY, gdy w sekcji lekcji w pliku absolutnie NIE podano żadnego tematu ani tytułu.

4. POZOSTAŁE POLA KAŻDEJ LEKCJI:
- studentId (string): ID wybranego dopasowanego kursanta.
- studentIds (array of strings): Lista ID wszystkich dopasowanych kursantów dla danej lekcji.
- revisionNotes (string): Omówione zagadnienia, teoria, notatki z lekcji.
- vocabularyText (string): Wyodrębnij WSZYSTKIE słówka, zwroty i idiomy, które pojawiają się w sekcji lekcji. Nawet jeśli są zapisane ciągiem (nie w kolumnie), wyłuskaj DOKŁADNIE KAŻDE z nich. Ułóż je w formacie: "słowo_angielskie - polskie_tłumaczenie" (każde słówko w osobnej linii). Uważaj, aby nie pominąć żadnego słowa z notatek.
- studentSpeaking (string): Uwagi dotyczące wypowiedzi kursanta, jego opinie, tematy na które się wypowiadał.
- thingsToImprove (string): Wskazówki, błędy gramatyczne, wymowa i rzeczy do poprawy.
- suggestedFollowUp (string): Praca domowa, ćwiczenia i zalecenia na przyszłość.

Przeanalizuj CAŁĄ treść dokładnie i nie pomijaj żadnej lekcji. Zwróć wyłącznie poprawny obiekt JSON z tablicą "lessons".

# FORMAT ODPOWIEDZI
Zwróć dokładnie taki kształt, bez komentarzy i bez bloku markdown:
{"lessons":[{"date":"2024-03-12","studentId":"abc123","studentIds":["abc123"],"lessonTopic":"Present Perfect","revisionNotes":"...","vocabularyText":"deadline - termin\\nto meet - spotkać","studentSpeaking":"...","thingsToImprove":"...","suggestedFollowUp":"..."}]}
Gdy w materiale nie ma żadnej lekcji, zwróć {"lessons":[]} — nigdy nie wymyślaj lekcji, których nie ma w tekście.`;

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
                suggestedFollowUp: { type: Type.STRING },
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
      if (!responseText) throw new Error("Model nie zwrócił odpowiedzi.");

      // `responseSchema` działa tylko dla Gemini — przy modelu OpenAI
      // generateContentWithRetry przekazuje wyłącznie `response_format: json_object`,
      // więc kształt odpowiedzi nie jest niczym wymuszony. Stąd tolerancyjne
      // wyciąganie JSON-a (model lubi owinąć go w blok markdown) i walidacja niżej.
      const json = extractJsonFromString(responseText);
      if (!json) {
        console.error('[import-lessons-batch] Odpowiedź bez poprawnego JSON:', responseText.slice(0, 400));
        throw new Error('Model zwrócił odpowiedź, której nie da się odczytać jako JSON.');
      }

      const lessons = normalizeImportedLessons(json, {
        today: new Date().toISOString().split('T')[0],
        fallbackStudentId: typeof targetStudentId === 'string' ? targetStudentId : '',
      });

      const rawCount = Array.isArray(json?.lessons) ? json.lessons.length : 0;
      console.log(`[import-lessons-batch] Model zwrócił ${rawCount} wpisów, po walidacji: ${lessons.length}`);
      res.json({ lessons });
    } catch (error: any) {
      console.error('Error in import-lessons-batch:', error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  // Smart Student Onboarding: analiza jednego pliku (.txt/.md/.pdf) z profilem
  // i historią lekcji nowego kursanta, przed założeniem konta.
  app.post('/api/gemini/analyze-student-import', requireFirebaseAdmin, async (req, res) => {
    try {
      const { textContent, pdfBase64 } = req.body;
      if (!textContent && !pdfBase64) {
        return res.status(400).json({ error: 'Missing textContent or pdfBase64' });
      }

      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) {
        return res.status(500).json({ error: 'AI API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in environment variables.' });
      }
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });

      let parsedDocText = textContent || '';
      let isPdfFallbackNeeded = false;

      if (pdfBase64) {
        try {
          const rawB64 = pdfBase64.split(',')[1] || pdfBase64;
          const pdfBuffer = Buffer.from(rawB64, 'base64');
          const pdfData = await pdfParse(pdfBuffer);
          if (pdfData && pdfData.text && pdfData.text.trim().length > 10) {
            parsedDocText = (parsedDocText ? parsedDocText + '\n\n' : '') + pdfData.text;
          } else {
            isPdfFallbackNeeded = true;
          }
        } catch (pdfErr) {
          console.warn('[analyze-student-import] pdf-parse failed, falling back to multi-modal PDF upload:', pdfErr);
          isPdfFallbackNeeded = true;
        }
      }

      const MAX_SOURCE_CHARS = 120000;
      if (parsedDocText.length > MAX_SOURCE_CHARS) {
        console.warn(`[analyze-student-import] Materiał ma ${parsedDocText.length} znaków — ucinam do ${MAX_SOURCE_CHARS}.`);
        parsedDocText = parsedDocText.slice(0, MAX_SOURCE_CHARS);
      }

      let contents: any[];
      if (isPdfFallbackNeeded && pdfBase64) {
        contents = [{
          role: 'user',
          parts: [
            { inlineData: { data: pdfBase64.split(',')[1] || pdfBase64, mimeType: 'application/pdf' } },
            { text: 'Przeanalizuj powyższy plik PDF z profilem i historią lekcji nowego kursanta.' }
          ]
        }];
      } else {
        contents = [{
          role: 'user',
          parts: [{ text: `Treść dokumentu/notatek o kursancie:\n${parsedDocText}` }]
        }];
      }

      const sysInstruction = `# Cel
Jesteś skrupulatnym asystentem lektora języka angielskiego weryfikującym profil nowego kursanta przed założeniem mu konta. Dostajesz plik (notatki, e-mail, wizytówkę, historię lekcji z innej platformy) i masz wyodrębnić z niego dane profilowe oraz historię dotychczasowych lekcji.

# CO WYCIĄGNĄĆ (extractedData):
- fullName: imię i nazwisko kursanta.
- email: adres e-mail, jeśli występuje w treści.
- level: poziom zaawansowania CEFR — DOKŁADNIE jedno z: A1, A2, B1, B2, C1, C2. Jeśli nie da się jednoznacznie ustalić, pomiń pole.
- targetGoals: cele nauki kursanta (np. "przygotowanie do rozmów biznesowych", "matura").
- industry: branża/zawód kursanta, jeśli wspomniana.
- generalNotes: inne istotne informacje o kursancie, których nie da się przypisać do powyższych pól.
- historicalLessons: lista dotychczasowych lekcji, każda z polami:
  - date: data lekcji w formacie YYYY-MM-DD. Jeśli w źródle brakuje roku (np. "15 maja") lub daty w ogóle, ustaw dateAmbiguous: true i podaj najlepsze przybliżenie (z dzisiejszym rokiem, jeśli rok nieznany).
  - summary: krótki opis tematu/przebiegu lekcji.
  - vocabulary: lista słówek/zwrotów omówionych na lekcji (same stringi, "słowo - tłumaczenie" jeśli tłumaczenie jest dostępne).
  - corrections: lista błędów/korekt językowych z lekcji (same stringi).

# ZASADY:
- NIE WYMYŚLAJ danych, których nie ma w tekście. Brakujące pole zostaw puste/pomiń.
- Jeśli w tekście nie ma żadnej historii lekcji, zwróć pustą tablicę historicalLessons.
- aiComment: krótkie podsumowanie w 1-2 zdaniach PO POLSKU — co znalazłeś i na co lektor powinien zwrócić uwagę.
- Zwróć wyłącznie poprawny obiekt JSON zgodny ze schematem, bez komentarzy i bloku markdown.`;

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
                    corrections: { type: Type.ARRAY, items: { type: Type.STRING } },
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
      if (!responseText) throw new Error("Model nie zwrócił odpowiedzi.");

      const json = extractJsonFromString(responseText);
      if (!json) {
        console.error('[analyze-student-import] Odpowiedź bez poprawnego JSON:', responseText.slice(0, 400));
        throw new Error('Model zwrócił odpowiedź, której nie da się odczytać jako JSON.');
      }

      const analysis = normalizeStudentImportAnalysis(json, new Date().toISOString().split('T')[0]);
      res.json({ analysis });
    } catch (error: any) {
      console.error('Error in analyze-student-import:', error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     GENERATOR SCENARIUSZA LEKCJI 2.0 (Etap 2.1)

     Kontrakt: klient wysyła wyłącznie { studentId, durationMin } i nigdy
     nie czyta Firestore przed wywołaniem AI. Backend czyta profil kursanta
     i ostatnią ukończoną lekcję, ustala tryb (returning/cold_start) i woła
     Gemini, które zwraca WYŁĄCZNIE treść 4 modułów — bez czasów i bez ID.
     Czasy (SCENARIO_DURATION_BUDGETS) i identyfikatory nadaje backend, żeby
     model nie mógł zepsuć matematyki czasu trwania lekcji. Zobacz
     types/scenario.ts. ═══════════════════════════════════════════════ */

  app.post('/api/scenario/generate', requireFirebaseAuth, async (req, res) => {
    try {
      const studentId = String(req.body?.studentId || '').trim();
      const durationMin = Number(req.body?.durationMin) as ScenarioDurationMin;

      if (!studentId) return res.status(400).json({ error: 'Nie wskazano kursanta.' });
      if (![45, 60, 90].includes(durationMin)) {
        return res.status(400).json({ error: 'Nieprawidłowa długość lekcji — dozwolone: 45, 60, 90 minut.' });
      }

      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY nie jest skonfigurowany.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      const scenario = await generateScenarioForStudent({
        adminDb, geminiApiKey, studentId, durationMin,
        generateContentWithRetry, geminiModelCascade: GEMINI_MODEL_CASCADE,
      });

      return res.json({ scenario });
    } catch (err: any) {
      if (err instanceof ScenarioContextError) {
        return res.status(err.code === 'not-found' ? 404 : 400).json({ error: err.code === 'not-found' ? err.message : 'insufficient-profile' });
      }
      console.error('[server] błąd generowania scenariusza lekcji:', err);
      return res.status(500).json({ error: err?.message || 'Nie udało się wygenerować scenariusza.' });
    }
  });

  /**
   * Tool czatu `generate_lesson_scenario` (Asystent Lektora). Klient wysyła
   * WYŁĄCZNIE { studentRef, durationMin?, customTopicFocus? } — nigdy sam ID
   * kursanta z Firestore, bo Gemini nie ma dostępu do bazy. Backend
   * rozstrzyga `studentRef` (imię lub ID) do kursanta wyłącznie w zbiorze
   * aktywnych kursantów (patrz `services/studentResolver.ts`) i woła
   * dokładnie tę samą funkcję generatora co `/api/scenario/generate` —
   * zero dublowania logiki.
   */
  app.post('/api/scenario/generate-for-chat', requireFirebaseAuth, async (req, res) => {
    try {
      const studentRef = String(req.body?.studentRef || '').trim();
      if (!studentRef) return res.status(400).json({ error: 'Nie podano kursanta.' });

      let durationMin = Number(req.body?.durationMin) as ScenarioDurationMin;
      if (![45, 60, 90].includes(durationMin)) durationMin = 45;

      const customTopicFocus = String(req.body?.customTopicFocus || '').trim().slice(0, 150) || undefined;

      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY nie jest skonfigurowany.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      const { studentId, displayName } = await resolveStudentRef(adminDb, studentRef);

      const scenario = await generateScenarioForStudent({
        adminDb, geminiApiKey, studentId, durationMin, customTopicFocus,
        generateContentWithRetry, geminiModelCascade: GEMINI_MODEL_CASCADE,
      });

      return res.json({ scenario, studentId, studentName: displayName });
    } catch (err: any) {
      if (err instanceof StudentResolutionError) {
        return res.status(err.code === 'not-found' ? 404 : 409).json({ error: err.message, candidates: err.candidates });
      }
      if (err instanceof ScenarioContextError) {
        return res.status(err.code === 'not-found' ? 404 : 400).json({ error: err.code === 'not-found' ? err.message : 'insufficient-profile' });
      }
      console.error('[server] błąd generowania scenariusza lekcji (tool czatu):', err);
      return res.status(500).json({ error: err?.message || 'Nie udało się wygenerować scenariusza.' });
    }
  });

  app.post('/api/scenario/save', requireFirebaseAuth, async (req, res) => {
    try {
      const studentId = String(req.body?.studentId || '').trim();
      const targetLessonId = String(req.body?.targetLessonId || '').trim();
      const scenario = req.body?.scenario as LessonScenario | undefined;

      if (!studentId) return res.status(400).json({ error: 'Nie wskazano kursanta.' });
      if (!targetLessonId) return res.status(400).json({ error: 'Nie wskazano lekcji docelowej.' });
      if (!scenario || !Array.isArray(scenario.modules)) {
        return res.status(400).json({ error: 'Brak poprawnego scenariusza do zapisania.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      const recordRef = adminDb.collection('users').doc(studentId).collection('lessonRecords').doc(targetLessonId);

      const recordSnap = await recordRef.get();
      if (!recordSnap.exists) {
        return res.status(404).json({ error: 'Nie znaleziono lekcji docelowej.' });
      }

      const scenarioSavedAt = new Date().toISOString();
      await recordRef.update({ plannedScenario: scenario, scenarioSavedAt });

      return res.json({ ok: true, scenarioSavedAt });
    } catch (err: any) {
      console.error('[server] błąd zapisu scenariusza lekcji:', err);
      return res.status(500).json({ error: err?.message || 'Nie udało się zapisać scenariusza.' });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     KREATOR SCENARIUSZY I INTERAKTYWNY CANVAS (MVP) — scenarioCanvasV2

     Kontrakt dodatkowy, opcjonalny, obok `plannedScenario` — patrz
     types/scenarioCanvas.ts. Planner → Auditor (Gemini) buduje draft
     canvasu; zapis następuje wyłącznie na żądanie lektora z UI, a Lesson
     Refresh podmienia SELEKTYWNIE wyłącznie odrzucone elementy, chroniony
     przez `expectedRevision`/`mutationId` przed podwójnym/stale zapisem.
     ═══════════════════════════════════════════════════════════════════ */

  app.post('/api/scenario/canvas/generate', requireFirebaseAuth, async (req, res) => {
    try {
      const studentId = String(req.body?.studentId || '').trim();
      const durationMin = Number(req.body?.durationMin) as ScenarioDurationMin;

      if (!studentId) return res.status(400).json({ error: 'Nie wskazano kursanta.' });
      if (![45, 60, 90].includes(durationMin)) {
        return res.status(400).json({ error: 'Nieprawidłowa długość lekcji — dozwolone: 45, 60, 90 minut.' });
      }

      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY nie jest skonfigurowany.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

      const canvas = await generateScenarioCanvasForStudent({
        adminDb, geminiApiKey, studentId, durationMin,
        generateContentWithRetry, geminiModelCascade: GEMINI_MODEL_CASCADE,
      });

      return res.json({ canvas });
    } catch (err: any) {
      if (err instanceof ScenarioContextError) {
        return res.status(err.code === 'not-found' ? 404 : 400).json({ error: err.code === 'not-found' ? err.message : 'insufficient-profile' });
      }
      console.error('[server] błąd generowania canvasu scenariusza:', err);
      return res.status(500).json({ error: err?.message || 'Nie udało się wygenerować canvasu.' });
    }
  });

  app.post('/api/scenario/canvas/save', requireFirebaseAuth, async (req, res) => {
    try {
      const studentId = String(req.body?.studentId || '').trim();
      const targetLessonId = String(req.body?.targetLessonId || '').trim();
      const canvas = req.body?.canvas as ScenarioCanvasV2 | undefined;

      if (!studentId) return res.status(400).json({ error: 'Nie wskazano kursanta.' });
      if (!targetLessonId) return res.status(400).json({ error: 'Nie wskazano lekcji docelowej.' });
      if (!canvas || canvas.version !== 2 || !Array.isArray(canvas.blocks)) {
        return res.status(400).json({ error: 'Brak poprawnego canvasu do zapisania.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      const recordRef = adminDb.collection('users').doc(studentId).collection('lessonRecords').doc(targetLessonId);

      const recordSnap = await recordRef.get();
      if (!recordSnap.exists) {
        return res.status(404).json({ error: 'Nie znaleziono lekcji docelowej.' });
      }

      const scenarioCanvasSavedAt = new Date().toISOString();
      await recordRef.update({ scenarioCanvasV2: canvas, scenarioCanvasSavedAt });

      return res.json({ ok: true, canvasSavedAt: scenarioCanvasSavedAt });
    } catch (err: any) {
      console.error('[server] błąd zapisu canvasu scenariusza:', err);
      return res.status(500).json({ error: err?.message || 'Nie udało się zapisać canvasu.' });
    }
  });

  app.post('/api/scenario/canvas/refresh', requireFirebaseAuth, async (req, res) => {
    try {
      const studentId = String(req.body?.studentId || '').trim();
      const targetLessonId = String(req.body?.targetLessonId || '').trim();
      const expectedRevision = Number(req.body?.expectedRevision);
      const mutationId = String(req.body?.mutationId || '').trim();
      const teacherNotes = Array.isArray(req.body?.teacherNotes) ? req.body.teacherNotes : [];

      if (!studentId) return res.status(400).json({ error: 'Nie wskazano kursanta.' });
      if (!targetLessonId) return res.status(400).json({ error: 'Nie wskazano lekcji docelowej.' });
      if (!mutationId) return res.status(400).json({ error: 'Brak mutationId.' });
      if (!Number.isFinite(expectedRevision)) return res.status(400).json({ error: 'Brak expectedRevision.' });

      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY nie jest skonfigurowany.' });
      }

      const adminApp = getAdminApp();
      const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
      const recordRef = adminDb.collection('users').doc(studentId).collection('lessonRecords').doc(targetLessonId);
      const recordSnap = await recordRef.get();
      if (!recordSnap.exists) {
        return res.status(404).json({ error: 'Nie znaleziono lekcji docelowej.' });
      }

      const data = recordSnap.data() || {};
      const storedCanvas = data.scenarioCanvasV2 as ScenarioCanvasV2 | undefined;
      if (!storedCanvas || storedCanvas.version !== 2) {
        return res.status(404).json({ error: 'Ta lekcja nie ma zapisanego canvasu scenariusza.' });
      }

      /* Podwójne kliknięcie tego samego mutationId na tej samej rewizji dostaje
         ten sam wynik bez ponownego wołania Gemini — idempotencja. */
      if (storedCanvas.lastMutationId === mutationId) {
        return res.json({ ok: true, canvas: storedCanvas });
      }

      if (storedCanvas.revision !== expectedRevision) {
        return res.status(409).json({ error: 'Canvas został już zmieniony przez inny zapis — odśwież i spróbuj ponownie.', canvas: storedCanvas });
      }

      const rejectedItemIds = getRejectedItemIds(storedCanvas);
      if (rejectedItemIds.length === 0) {
        return res.status(400).json({ error: 'Brak odrzuconych elementów — nie ma czego odświeżać.' });
      }

      const refreshedCanvas = await refreshScenarioCanvasBlocks({
        geminiApiKey,
        generateContentWithRetry,
        geminiModelCascade: GEMINI_MODEL_CASCADE,
        canvas: storedCanvas,
        rejectedItemIds,
        teacherNotes,
        mutationId,
      });

      await recordRef.update({ scenarioCanvasV2: refreshedCanvas, scenarioCanvasSavedAt: refreshedCanvas.updatedAt });

      return res.json({ ok: true, canvas: refreshedCanvas });
    } catch (err: any) {
      console.error('[server] błąd Lesson Refresh canvasu:', err);
      return res.status(500).json({ error: err?.message || 'Nie udało się odświeżyć canvasu.' });
    }
  });

  app.post('/api/gemini/lesson-summary', requireFirebaseAdmin, async (req, res) => {
    try {
      const { notes, pdfBase64, driveFile, students, mode } = req.body;
      /* Dwa rodzaje materiału, dwa różne zadania — patrz komentarz przy
         poleceniach systemowych niżej. Domyślnie „notes", bo tak było dotąd. */
      const isTranscript = mode === 'transcript';
      if (!notes && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: 'Missing notes, pdfBase64 or driveFile' });
      }
      
      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) {
        return res.status(500).json({ error: 'AI API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in environment variables.' });
      }

      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      
      const studentsListStr = typeof students === 'string' 
        ? students 
        : (Array.isArray(students) 
            ? students.map((s: any) => `ID: ${s.id} | Imię/Nazwisko: ${s.name || s.username || ''} | Poziom: ${s.level || ''} | Opis: ${s.description || ''}`).join('\n')
            : 'Brak bazy kursantów');

      let promptContext: any[] = [];
      
      if (driveFile) {
        const url = driveFile.mimeType === 'application/pdf' 
          ? `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media`
          : `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=text/plain`;
          
        const fetchRes = await fetch(url, { headers: { Authorization: `Bearer ${driveFile.token}` } });
        if (!fetchRes.ok) throw new Error("Failed to fetch from Google Drive: " + await fetchRes.text());
        
        if (driveFile.mimeType === 'application/pdf') {
            const arrayBuffer = await fetchRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            promptContext = [{
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: buffer.toString('base64'),
                    mimeType: 'application/pdf'
                  }
                },
                { text: `Baza kursantów:\n${studentsListStr}\n\nPowyżej znajduje się plik PDF ${isTranscript ? 'z TRANSKRYPCJĄ lekcji (zapisem rozmowy)' : 'z notatkami z lekcji'}. Przeanalizuj go.` }
              ]
            }];
        } else {
            const text = await fetchRes.text();
            promptContext = [{
              role: 'user',
              parts: [{ text: `Baza kursantów:\n${studentsListStr}\n\nTranskrypcja/Notatki ze spotkania (Google Docs / Text):\n${text}` }]
            }];
        }
      } else if (pdfBase64) {
        promptContext = [{
          role: 'user',
          parts: [
            {
              inlineData: {
                data: pdfBase64.split(',')[1] || pdfBase64,
                mimeType: 'application/pdf'
              }
            },
            { text: `Baza kursantów:\n${studentsListStr}\n\nPowyżej znajduje się plik PDF ${isTranscript ? 'z TRANSKRYPCJĄ lekcji (zapisem rozmowy)' : 'z notatkami z lekcji'}. Przeanalizuj go.` }
          ]
        }];
      } else {
        promptContext = [{
          role: 'user',
          parts: [{ text: `Baza kursantów:\n${studentsListStr}\n\n${isTranscript ? 'SUROWA TRANSKRYPCJA LEKCJI (zapis rozmowy)' : 'Notatki ze spotkania'}:\n${notes}` }]
        }];
      }

      /*
       * ══ DWA ŹRÓDŁA, DWA ZADANIA ══
       *
       * „notes" to GOTOWE podsumowanie spotkania — ktoś (człowiek albo
       * narzędzie do notatek) już wybrał, co jest ważne. Robota modelu polega
       * wtedy na przepisaniu tego do pól aplikacji.
       *
       * „transcript" to SUROWY ZAPIS ROZMOWY: godzina mówienia, w której
       * słownictwo, błędy i ustalenia leżą wymieszane z „yhy", powtórzeniami
       * i rozmową o pogodzie. Tu nie ma czego przepisywać — trzeba to wydobyć
       * i ułożyć. Dawanie obu materiałom tego samego polecenia dawało
       * z transkrypcji trzy zdania streszczenia i pustą resztę pól, bo model
       * szukał gotowych sekcji, których w rozmowie nie ma.
       *
       * Układ docelowy nie jest dowolny: to te same bloki, które kursant
       * i lektor widzą w historii lekcji (utils/lessonBlocks.ts) — Lekcja
       * w skrócie, Key Language (słownictwo + korekty), Next Lesson, plus
       * Learning Curve o wypowiedzi kursanta. Praca domowa (dawny Blok 3)
       * już tu nie wraca: żyje wyłącznie w osobnym module ćwiczeń, więc
       * dublowanie jej w notatce z lekcji było martwym powtórzeniem, nie
       * kompletnością układu.
       */
      const transcriptInstruction = `# Cel
Dostajesz SUROWĄ TRANSKRYPCJĘ lekcji języka angielskiego (zapis rozmowy lektora z kursantem) albo plik z takim zapisem.
Twoim zadaniem jest wydobyć z niej WSZYSTKIE informacje o wartości dydaktycznej i ułożyć je w STANDARDOWY UKŁAD BLOKÓW, który kursant i lektor widzą w historii lekcji.
To nie jest streszczanie. To porządkowanie: nic, co padło w rozmowie i ma wartość do nauki, nie może zniknąć.

# Czego szukasz w zapisie rozmowy
Przejdź transkrypcję od początku do końca i wynotuj:
- KAŻDE słowo, zwrot, kolokację i idiom, które lektor podał, wyjaśnił, przetłumaczył albo poprawił — również te wplecione w zdanie i nigdzie nie wypisane,
- KAŻDĄ poprawkę błędu kursanta: co powiedział źle i jak brzmi poprawnie,
- uwagi o wymowie (akcent wyrazowy, konkretne głoski, intonacja),
- zagadnienia gramatyczne, które były omawiane lub ćwiczone,
- ustalenia na przyszłość i wszystko, co lektor zapowiedział albo zadał,
- czym kursant się zajmuje i o czym mówił — to materiał na kolejne lekcje.
Pomijaj wyłącznie to, co nie niesie treści: powitania, „yhy", problemy techniczne, ustalanie terminu, przerwy.

# Zasady
- Wszystkie pola opisowe pisz PO POLSKU. Słownictwo naturalnie dwujęzycznie: "angielskie słowo - polskie tłumaczenie".
- NIE WYMYŚLAJ niczego, czego nie ma w zapisie. Jeśli w rozmowie brakuje materiału do danego pola, wpisz: Brak danych w transkrypcji.
- Nie generuj pracy domowej, zdań do tłumaczenia ani żadnych ćwiczeń — praca domowa żyje wyłącznie w osobnym module ćwiczeń, nie w notatce z lekcji.
- Daty nie zgaduj: jeśli w zapisie nie padła, zostaw pole date puste.

# Zanim wygenerujesz
Na podstawie podanej bazy kursantów dopasuj studentId oraz studentIds (gdy lekcja była grupowa). Dostosuj poziom języka do profilu kursanta.

# Zwróć JSON o polach
- studentId (string, ID głównego kursanta z bazy; puste, gdy nie da się dopasować)
- studentIds (array of strings, wszyscy kursanci tej lekcji)
- date (string, YYYY-MM-DD — wyłącznie jeśli data padła w zapisie; inaczej puste)
- lessonTopic (string, zwięzłe hasło tematu, maksymalnie 50 znaków, bez daty)
- revisionNotes (string, BLOK 1 „Lekcja w skrócie": przebieg lekcji po polsku, 4-8 zdań — co ćwiczyliście i w jakiej kolejności)
- vocabularyText (string, BLOK 2 „Key Language": każde słówko i zwrot w osobnej linii, ściśle "angielskie - polskie". Bez punktorów, bez markdown, bez numeracji.)
- corrections (string, BLOK 2b „Korekty i wymowa": poprawki w formacie "❌ to, co powiedział kursant → ✅ poprawna wersja", po jednej na linię, z krótkim wyjaśnieniem po polsku, gdy jest potrzebne. Tu trafiają też uwagi o wymowie.)
- nextLessonPlan (string, BLOK 4 „Next Lesson": ustalenia i najlepsze tematy na kolejne zajęcia, po polsku)
- studentSpeaking (string, „Learning Curve": 5-6 zdań po polsku, neutralnie — o czym kursant mówił, jak mu szło, co go interesuje)
- thingsToImprove (string, ta sama treść co corrections — dla zgodności ze starszymi widokami)
- suggestedFollowUp (string, ta sama treść co nextLessonPlan — dla zgodności ze starszymi widokami)
`;

      const sysInstruction = `# Cel
Na podstawie AI meeting notes przygotuj podsumowanie lekcji języka angielskiego dla kursanta.
Źródłem danych jest gotowe podsumowanie spotkania. Jeśli gotowe podsumowanie jest niewystarczające, użyj pełnej transkrypcji.
Ta wersja promptu służy do uzupełniania pól w aplikacji Cribro. Każda sekcja ma odpowiadać jednemu polu w aplikacji.
Nie generuj pracy domowej, zdań do tłumaczenia, ćwiczeń z lukami ani zadań spaced repetition.
Wszystkie pola opisowe (revisionNotes, studentSpeaking, thingsToImprove, suggestedFollowUp) wygeneruj w języku polskim. Słownictwo naturalnie ma być w dwóch językach (słowo angielskie - polskie tłumaczenie).
Jeśli w materiale brakuje danych do danej sekcji, wpisz po polsku:
Brak danych w transkrypcji.

# Zanim wygenerujesz
Zidentyfikuj kursanta lub kursantów, których dotyczy lekcja na podstawie podanej bazy kursantów i dopasuj studentId oraz studentIds (jeśli to lekcja grupowa dla kilku kursantów). Dostosuj poziom języka i szczegółowość treści do profilu kursantów.

# Wygeneruj wynik w formacie JSON
Zwróć wynik jako JSON z poniższymi polami:
- studentId (string, ID głównego wybranego kursanta z Bazy Kursantów, jeśli nie potrafisz dopasować zostaw puste)
- studentIds (array of strings, Lista ID wszystkich kursantów z Bazy Kursantów, jeśli lekcja dotyczyła grupy lub kilku osób)
- lessonTopic (string, Krótkie, jednozdaniowe podsumowanie tematu lekcji na podstawie revision notes. Maksymalnie 50 znaków, bez daty, zwięzłe hasło bez wieloczęściowych zdań.)
- revisionNotes (string, Krótkie podsumowanie lekcji w stronie biernej po polsku, 3-6 zdań)
- vocabularyText (string, Wyodrębnij WSZYSTKIE słówka, zwroty i idiomy, które pojawiają się w notatkach z lekcji. Nawet jeśli są zapisane ciągiem (nie w kolumnie) lub wplecione w tekst, wyłuskaj DOKŁADNIE KAŻDE z nich. Ułóż je ściśle w formacie: "słowo_angielskie - polskie_tłumaczenie" w osobnych linijkach. Uważaj, aby nie pominąć żadnego słowa. Do not include markdown formatting or bullet points.)
- studentSpeaking (string, Krótkie memory o kursancie po polsku, 5-6 zdań neutralnie o czym mówił, styl itp.)
- thingsToImprove (string, 2-3 obszary wymagające poprawy z diagnozą i przykładami, po polsku)
- suggestedFollowUp (string, Ustalenia i najlepsze tematy na kolejną lekcję, po polsku)
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
          nextLessonPlan: { type: Type.STRING },
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
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });
  // Proxy for Gemini API if we ever want to move Gemini to server-side
  // Right now, keeping what's there on Vite fallback for now.


  
  /**
   * Sprawdzanie pisowni/stylu w Notatniku A4 — dwujęzyczne (PL/EN), bo
   * notatka lektora miesza oba języki w jednym akapicie. Dostaje sam tekst
   * (nie HTML — znaczniki tylko myliłyby model i nie są potrzebne do
   * zlokalizowania błędu, o to dba `contextSnippet` po stronie klienta).
   */
  app.post('/api/notebook/spellcheck', requireFirebaseAdmin, async (req, res) => {
    try {
      const { text } = req.body;
      if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Missing notebook text.' });
      }

      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) {
        return res.status(500).json({ error: 'AI API key not configured.' });
      }

      const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy' });

      const schema = {
        type: Type.OBJECT,
        properties: {
          issues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                matchedText: { type: Type.STRING },
                contextSnippet: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['spelling', 'grammar', 'awkward'] },
                shortReason: { type: Type.STRING },
              },
              required: ['id', 'matchedText', 'contextSnippet', 'suggestion', 'type', 'shortReason'],
            },
          },
        },
        required: ['issues'],
      };

      const response = await generateContentWithRetry(ai, text.slice(0, 20000), {
        systemInstruction:
          'Jesteś profesjonalnym korektorem językowym notatek lektora języka angielskiego. Notatki są dwujęzyczne (polski i angielski współistnieją w jednym dokumencie: wyjaśnienia po polsku, zwroty docelowe i przykłady po angielsku). Nie oznaczaj poprawnych słów angielskich jako błędów w polszczyźnie ani odwrotnie. Wykrywaj: 1) literówki, błędy ortograficzne i brak znaków diakrytycznych, 2) rażące błędy gramatyczne, 3) słowa/zwroty nienaturalne w danym kontekście (awkward phrasing, kalki językowe). Zwróć wyłącznie poprawny JSON.',
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 0 },
      }, [PRIMARY_MODEL]);

      const responseText = response?.text;
      if (!responseText) return res.json({ issues: [] });

      const json = JSON.parse(responseText);
      const issues = Array.isArray(json?.issues) ? json.issues : [];
      res.json({ issues });
    } catch (error: any) {
      console.error('[Notebook Spellcheck]', error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  });

  app.post('/api/gemini/grade-test', requireFirebaseAuth, async (req, res) => {
    try {
      const { testTitle, questions, studentAnswers } = req.body;
      const prompt = `Jesteś nauczycielem języka angielskiego. Sprawdź odpowiedzi ucznia w teście o tytule "${testTitle}".
Oto pytania i odpowiedzi ucznia:
${questions.map((q: any, index: number) => {
  return `
Zadanie ${index + 1}. [${q.type}]
Polecenie/Treść: ${q.prompt}
Odpowiedź ucznia: ${studentAnswers[q.id] || "Brak odpowiedzi"}
Poprawna odpowiedź (dla zadań zamkniętych): ${q.correctAnswer || "Zadanie otwarte/writing"}`;
}).join('\n')}

Twoim zadaniem jest ocenić ten test i dostarczyć konstruktywny, motywujący feedback dla kursanta w języku polskim.
Przeanalizuj każdą odpowiedź ucznia. Zwróć szczególną uwagę na zadania typu "find_mistake" (czy uczeń poprawnie naprawił błąd w zdaniu i zachował poprawną strukturę) oraz "writing" - wskaż błędy, ale też pochwal za dobre użycie struktur.
ZASADA INTERPUNKCJI: Pamiętaj, że interpunkcja (kropki, przecinki, wielkie litery) jest potrzebna i jest dobrą praktyką, ale NIE MOŻE obniżać oceny ani powodować odejmowania punktów.
Na koniec przyznaj łączną ocenę (np. w procentach lub punktach).

Zwróć JSON z polami:
- score (liczba, przyznane punkty całkowite)
- feedback (string, Twój szczegółowy feedback dla ucznia, z wylistowanymi błędami i poradami)
`;

      
      const apiKey = getGeminiApiKey();
      if (!apiKey && !getOpenAIApiKey()) return res.status(500).json({ error: "AI API key not configured." });
      const ai = new GoogleGenAI({ apiKey: apiKey || "dummy" });
      const response = await generateContentWithRetry(ai, prompt, {
        responseMimeType: 'application/json',
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
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: formatErrorString(err) });
    }
  });

  app.post('/api/gemini/student-stats-summary', requireFirebaseAuth, async (req, res) => {
    try {
      const { stats, logsSummary, language } = req.body;
      const geminiApiKey = getGeminiApiKey();
      const openaiApiKey = getOpenAIApiKey();

      if (!geminiApiKey && !openaiApiKey) {
        return res.status(500).json({ error: 'No AI API key configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in environment variables.' });
      }
      
      const ai = new GoogleGenAI({ apiKey: geminiApiKey || 'DUMMY' });
      
      const isPl = language !== 'en';
      const prompt = `Jesteś doświadczonym, empatycznym i wybitnym metodykiem oraz nauczycielem języka angielskiego (ELT Pedagogical Specialist & Language Coach).
Twoim zadaniem jest przedstawienie kompleksowego, merytorycznego i metodycznego komentarza dla kursanta na podstawie analizy jego wyników w ćwiczeniach językowych.

Oto statystyki liczbowe kursanta:
- Łączna liczba sesji ćwiczeniowych: ${stats?.totalExercises || 0}
- Średni wynik procentowy poprawności: ${stats?.averageScore || 0}%
- Przetłumaczone zdania/słowa: ${stats?.totalWords || 0}
- Obecny streak (dni nauki z rzędu): ${stats?.currentStreak || 0}
- Najdłuższy streak: ${stats?.longestStreak || 0}

Oto analiza wykonanych zdań i szczegółowych logów ćwiczeń:
${logsSummary || "Brak szczegółowych zdań z ćwiczeń."}

Wypełnij poniższe pola w języku ${isPl ? 'polskim' : 'angielskim'}:
1. "overallTeacherCommentary": Merytoryczny i metodyczny podsumowujący komentarz nauczyciela języka angielskiego (2-3 wartościowe akapity). Odnieś się do konkretnych struktur, które kursant opanował oraz do błędów, które popełnia. Podaj wyjaśnienie dlaczego dany błąd powstaje (np. kalka z języka polskiego, niepoprawny czas, złe przyimki) i jak go unikać. Używaj zachęcającego, profesjonalnego tonu.
2. "keyStrengths": Tablica 2-4 konkretnych punktów / mocnych stron w opanowaniu angielskiego.
3. "areasToImprove": Tablica 2-4 konkretnych zagadnień gramatycznych lub leksykalnych do dalszego ćwiczenia.
4. "pedagogicalTip": 1-2 zdaniowa praktyczna poradnikowa wskazówka metodyczna na nadchodzące sesje.

Zwróć obiekt JSON z polami: overallTeacherCommentary (string), keyStrengths (array of strings), areasToImprove (array of strings), pedagogicalTip (string).`;

      const response = await generateContentWithRetry(ai, prompt, {
        responseMimeType: 'application/json',
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
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
      res.json(JSON.parse(cleanText));
    } catch (err: any) {
      console.error("Error in student-stats-summary endpoint:", err);
      res.status(500).json({ error: formatErrorString(err) });
    }
  });

  // Text-to-Speech API (Primary: OpenAI tts-1 -> Fallback 1: gpt-4o-mini-tts -> Fallback 2: gemini-2.0-flash)
  const handleTTS = async (req: express.Request, res: express.Response) => {
    // CORS tylko dla origin-ów wpisanych do ALLOWED_ORIGINS. Wcześniej stała
    // tu gwiazdka, przez którą dowolna strona mogła wpiąć się w ten strumień
    // i generować mowę na koszt tego projektu.
    const origin = req.headers.origin;
    const allowed = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map(o => o.trim())
      .filter(Boolean);
    if (origin && allowed.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    // Token przychodzi nagłówkiem (fetch) albo parametrem `t` (audio.src,
    // gdzie nagłówka dołożyć się nie da — patrz services/ttsService.ts).
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const idToken = bearer || String(req.query.t || '');
    if (!idToken || idToken === 'null' || idToken === 'undefined') {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }
    try {
      await adminAuth.verifyIdToken(idToken);
    } catch (err: any) {
      console.warn('[TTS] Auth token verification failed:', err.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    try {
      const text = (req.body?.text || req.query.text) as string;
      const lang = (req.body?.accent || req.body?.lang || req.query.lang || req.query.accent || 'en-US') as string;
      const gender = (req.body?.gender || req.query.gender || 'male') as string;
      const speed = parseFloat((req.body?.speed || req.query.speed || '1.0') as string) || 1.0;
      const engine = (req.body?.engine || req.query.engine || 'auto') as string;

      const isUK = lang === 'UK' || lang === 'en-GB' || lang === 'BrE';
      const isMale = gender === 'male' || gender === 'm' || (!gender.includes('female') && !gender.includes('f'));

      if (!text) {
        return res.status(400).json({ error: "Missing text parameter" });
      }

      // Format text: ensure proper punctuation at end for TTS natural cadence
      const trimmedText = text.replace(/<[^>]+>/g, '').trim();
      const formattedText = /[.?!]$/.test(trimmedText) ? trimmedText : `${trimmedText}.`;

      // 1. GENERATE CACHE KEY & CHECK CACHE
      const crypto = await import('crypto');
      const hash = crypto.default
        .createHash('sha256')
        .update(`${formattedText}_${isUK ? 'UK' : 'US'}_${isMale ? 'M' : 'F'}_${speed.toFixed(2)}_${engine}`)
        .digest('hex');
      const fileName = `tts_cache/${hash}.mp3`;
      
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs/promises');
      const localCacheDir = path.join(os.tmpdir(), 'tts_cache');
      await fs.mkdir(localCacheDir, { recursive: true });
      const localFileName = path.join(localCacheDir, `${hash}.mp3`);

      // Check Local Cache First (Instant 0ms latency)
      try {
        const localBuffer = await fs.readFile(localFileName);
        res.set({
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000',
          'Accept-Ranges': 'bytes'
        });
        return res.send(localBuffer);
      } catch (e) {
        // Not in local cache
      }

      let bucket: any = null;
      try {
        const { getStorage } = await import('firebase-admin/storage');
        const fbConfig = (await import('./firebase-applet-config.json')).default;
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || fbConfig.storageBucket || "gen-lang-client-0425391821.firebasestorage.app";
        if (bucketName) {
          bucket = getStorage().bucket(bucketName);
          const file = bucket.file(fileName);
          const [exists] = await file.exists();
          if (exists) {
            const [audioBuffer] = await file.download();
            fs.writeFile(localFileName, audioBuffer).catch(()=>{});
            res.set({
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=31536000',
              'Accept-Ranges': 'bytes'
            });
            return res.send(audioBuffer);
          }
        }
      } catch (err: any) {
        // Continue to generation pipeline
      }

      let finalAudioBuffer: Buffer | null = null;
      let contentType = 'audio/mpeg';
      const openaiKey = getOpenAIApiKey();

      // Voice selection for OpenAI models
      // US: male -> 'echo' (or 'onyx'), female -> 'nova' (or 'alloy')
      // UK: male -> 'fable', female -> 'shimmer'
      const openAiVoice = isUK ? (isMale ? "fable" : "shimmer") : (isMale ? "echo" : "nova");

      // =========================================================================
      // POZIOM 1: DOMYŚLNY - OpenAI TTS-1 (Szybki, studyjny, naturalny)
      // =========================================================================
      if (!finalAudioBuffer && (engine === 'auto' || engine === 'openai') && openaiKey) {
        try {
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: formattedText,
              voice: openAiVoice,
              speed: Math.max(0.75, Math.min(1.25, speed))
            })
          });
          if (response.ok) {
            finalAudioBuffer = Buffer.from(await response.arrayBuffer());
            contentType = 'audio/mpeg';
          } else {
            const errTxt = await response.text();
            console.warn(`[TTS Tier 1 - OpenAI tts-1] API error (${response.status}): ${errTxt.slice(0, 150)}`);
          }
        } catch (e: any) {
          console.warn('[TTS Tier 1 - OpenAI tts-1] Request failed:', e.message || e);
        }
      }

      // =========================================================================
      // POZIOM 2: FALLBACK 1 - GPT-4o-mini TTS (gpt-4o-mini-audio-preview / tts-1-hd)
      // =========================================================================
      if (!finalAudioBuffer && (engine === 'auto' || engine === 'gpt4o-mini' || engine === 'openai') && openaiKey) {
        try {
          // Attempt 2a: gpt-4o-mini-audio-preview via chat completions
          const miniAudioResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini-audio-preview',
              modalities: ['text', 'audio'],
              audio: {
                voice: openAiVoice,
                format: 'mp3'
              },
              messages: [
                {
                  role: 'system',
                  content: 'You are a clean text-to-speech voice synthesizer. Say the provided text clearly and naturally, without any conversational preamble or pleasantries.'
                },
                {
                  role: 'user',
                  content: formattedText
                }
              ]
            })
          });

          if (miniAudioResponse.ok) {
            const miniData = await miniAudioResponse.json();
            const audioBase64 = miniData?.choices?.[0]?.message?.audio?.data;
            if (audioBase64) {
              finalAudioBuffer = Buffer.from(audioBase64, 'base64');
              contentType = 'audio/mpeg';
            }
          } else {
            // Attempt 2b: Fallback to tts-1-hd
            const hdResponse = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'tts-1-hd',
                input: formattedText,
                voice: openAiVoice,
                speed: Math.max(0.75, Math.min(1.25, speed))
              })
            });
            if (hdResponse.ok) {
              finalAudioBuffer = Buffer.from(await hdResponse.arrayBuffer());
              contentType = 'audio/mpeg';
            }
          }
        } catch (e: any) {
          console.warn('[TTS Tier 2 - gpt-4o-mini-tts] Request failed:', e.message || e);
        }
      }

      // =========================================================================
      // POZIOM 3: FALLBACK 2 - Gemini TTS Audio Generation
      // =========================================================================
      const geminiKey = getGeminiApiKey();
      if (!finalAudioBuffer && (engine === 'auto' || engine === 'gemini') && geminiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const voiceName = isMale ? 'Puck' : 'Kore';
          const modelsToTry = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash"];
          
          for (const m of modelsToTry) {
            try {
              const geminiResponse = await ai.models.generateContent({
                model: m,
                contents: [{ parts: [{ text: `Say clearly with natural pronunciation: ${formattedText}` }] }],
                config: {
                  responseModalities: ["AUDIO" as any],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceName },
                    } as any,
                  },
                }
              });

              const base64Audio = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                const rawMime = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';
                finalAudioBuffer = Buffer.from(base64Audio, 'base64');
                contentType = rawMime;
                break;
              }
            } catch (innerE: any) {
              console.warn(`[TTS Tier 3 - Gemini Audio ${m}] failed:`, innerE.message || innerE);
            }
          }
        } catch (e: any) {
          console.warn('[TTS Tier 3 - Gemini Audio] generation failed:', e.message || e);
        }
      }

      // Save to cache and return stream if generated
      if (finalAudioBuffer) {
        fs.writeFile(localFileName, finalAudioBuffer).catch(() => {});
        
        if (bucket) {
          const file = bucket.file(fileName);
          file.save(finalAudioBuffer, {
            metadata: { contentType: contentType }
          }).catch((e: any) => console.warn('Firebase Storage cache write:', e.message || e));
        }
        
        res.set({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'Accept-Ranges': 'bytes'
        });
        return res.send(finalAudioBuffer);
      }

      return res.status(503).json({ error: 'Usługa TTS chwilowo niedostępna na serwerze.' });
    } catch (error: any) {
      console.error('[TTS] error:', error.message || error);
      res.status(500).json({ error: formatErrorString(error) });
    }
  };
  app.get("/api/tts", handleTTS);
  app.post("/api/tts", handleTTS);

  // --- OPENAI API PROXIES ---
  const handleOpenAI = async (req: any, res: any) => {
    try {
      const { prompt, systemInstruction, isJson, messages, model } = req.body || {};
      if (!prompt && !messages) return res.status(400).json({ error: 'Missing prompt or messages' });

      const openaiKey = getOpenAIApiKey();
      const geminiKey = getGeminiApiKey();

      let sysInst = systemInstruction || "";
      if (isJson && !sysInst.toLowerCase().includes('json')) {
        sysInst = (sysInst ? sysInst + "\n\n" : "") + "Respond in valid JSON format.";
      }

      let chatMessages: Array<{ role: string; content: string }> = [];
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
        if (isJson && !userPrompt.toLowerCase().includes('json')) {
          userPrompt += "\n\n(Output must be in valid JSON format)";
        }
        chatMessages.push({ role: "user", content: userPrompt || "Generate content" });
      }

      // Nazwy logiczne z kaskady; `mapToActualOpenAIModel` przekłada je niżej
      // na realny endpoint OpenAI.
      const openAiModels = openAiModelsFor(model);
      let openAiSuccess = false;
      let resultText = "";
      let usedModel = "";

      if (openaiKey) {
        for (const modelName of openAiModels) {
          const actualApiTarget = mapToActualOpenAIModel(modelName);
          console.log(`OpenAI Pipeline -> Wywołuję model: ${modelName} (target API: ${actualApiTarget})`);
          
          try {
            const bodyPayload: any = {
              model: actualApiTarget,
              messages: chatMessages,
              temperature: 0.7
            };

            if (isJson) {
              bodyPayload.response_format = { type: "json_object" };
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

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
              if (response.status === 401 || errText.includes('insufficient_quota')) {
                console.warn("OpenAI API key invalid or quota exceeded. Skipping remaining OpenAI models.");
                break;
              }
            }
          } catch (mErr: any) {
            console.warn(`OpenAI model ${modelName} exception:`, mErr?.message || mErr);
          }
        }
      } else {
        console.warn("OPENAI_API_KEY missing on server.");
      }

      if (openAiSuccess && resultText) {
        return res.json({ text: resultText, modelUsed: usedModel });
      }

      // Ultimate Fallback to Gemini 3.7 / 2.5 Flash
      console.log("OpenAI Fallback -> Przełączam na model Gemini. Key present:", Boolean(geminiKey));
      if (geminiKey) {
        const geminiModels = GEMINI_MODEL_CASCADE;
        for (const gModel of geminiModels) {
          let gRetries = 2;
          while (gRetries > 0) {
            try {
              const ai = new GoogleGenAI({ apiKey: geminiKey });
              let fullPrompt = prompt || "";
              if (!fullPrompt && Array.isArray(messages)) {
                fullPrompt = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");
              }

              const geminiConfig: any = {};
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
            } catch (gErr: any) {
              console.warn(`Gemini fallback ${gModel} exception (retries left ${gRetries - 1}):`, gErr?.message || gErr);
              gRetries--;
              if (gRetries > 0) {
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          }
        }
      }

      return res.status(503).json({ error: "Usługa AI jest chwilowo niedostępna." });
    } catch (err: any) {
      console.error("OpenAI handler error:", err);
      return res.status(503).json({ error: "Usługa AI jest chwilowo niedostępna." });
    }
  };

  // --- ANTHROPIC CLAUDE PROXY ---
  const handleAnthropic = async (req: any, res: any) => {
    try {
      const { prompt, systemInstruction, messages, model, max_tokens, isJson } = req.body || {};
      if (!prompt && !messages) return res.status(400).json({ error: 'Missing prompt or messages' });

      const anthropicKey = getAnthropicApiKey();
      if (!anthropicKey) {
        console.warn("[Anthropic] Brak ANTHROPIC_API_KEY na serwerze.");
        return res.status(503).json({ error: "Brak skonfigurowanego klucza Anthropic API (ANTHROPIC_API_KEY)." });
      }

      let sysInst = systemInstruction || "";
      if (isJson && !sysInst.toLowerCase().includes('json')) {
        sysInst = (sysInst ? sysInst + "\n\n" : "") + "Respond in valid JSON format only.";
      }

      let chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
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
        if (isJson && !userPrompt.toLowerCase().includes('json')) {
          userPrompt += "\n\n(Output must be valid JSON)";
        }
        chatMessages.push({ role: "user", content: userPrompt || "Generate content" });
      }

      const targetModel = mapToActualAnthropicModel(model);
      console.log(`Anthropic Pipeline -> Wywołuję model: ${model} (target API: ${targetModel})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const bodyPayload: any = {
        model: targetModel,
        max_tokens: max_tokens || 4096,
        messages: chatMessages,
        temperature: 0.7,
      };
      if (sysInst) {
        bodyPayload.system = sysInst;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
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
    } catch (err: any) {
      console.error("Anthropic handler error:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  };

  // --- DEEPSEEK PROXY ---
  const handleDeepSeek = async (req: any, res: any) => {
    try {
      const { prompt, systemInstruction, messages, model, isJson } = req.body || {};
      if (!prompt && !messages) return res.status(400).json({ error: 'Missing prompt or messages' });

      const deepseekKey = getDeepSeekApiKey();
      if (!deepseekKey) {
        console.warn("[DeepSeek] Brak DEEPSEEK_API_KEY na serwerze.");
        return res.status(503).json({ error: "Brak skonfigurowanego klucza DeepSeek API (DEEPSEEK_API_KEY)." });
      }

      let sysInst = systemInstruction || "";
      if (isJson && !sysInst.toLowerCase().includes('json')) {
        sysInst = (sysInst ? sysInst + "\n\n" : "") + "Respond in valid JSON format.";
      }

      let chatMessages: Array<{ role: string; content: string }> = [];
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
        if (isJson && !userPrompt.toLowerCase().includes('json')) {
          userPrompt += "\n\n(Output must be in valid JSON format)";
        }
        chatMessages.push({ role: "user", content: userPrompt || "Generate content" });
      }

      const targetModel = mapToActualDeepSeekModel(model);
      console.log(`DeepSeek Pipeline -> Wywołuję model: ${model} (target API: ${targetModel})`);

      const bodyPayload: any = {
        model: targetModel,
        messages: chatMessages,
        temperature: targetModel === 'deepseek-reasoner' ? undefined : 0.7,
      };
      if (isJson && targetModel !== 'deepseek-reasoner') {
        bodyPayload.response_format = { type: 'json_object' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

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
    } catch (err: any) {
      console.error("DeepSeek handler error:", err);
      return res.status(500).json({ error: formatErrorString(err) });
    }
  };

  // --- GEMINI PROXY ---
  //
  // Klucz Gemini nie może istnieć w przeglądarce. Vite wkleja każdą zmienną
  // VITE_* wprost do bundla, więc dawne `new GoogleGenAI({ apiKey:
  // import.meta.env.VITE_GEMINI_API_KEY })` wysyłało płatny klucz każdemu, kto
  // otworzył stronę. Klient woła teraz ten endpoint, a klucz zostaje tutaj.
  //
  // Trasa celowo przepuszcza `contents` i `config` bez zmian: po drugiej
  // stronie stoi cienki proxy w services/geminiService.ts, który udaje
  // `ai.models.generateContent`, dzięki czemu miejsca wywołań w aplikacji
  // wyglądają tak samo jak przed przeniesieniem.
  const GEMINI_MODEL_PATTERN = /^gemini-[a-z0-9.\-]{1,60}$/i;

  app.post("/api/gemini/generate", requireFirebaseAuth, async (req, res) => {
    try {
      const { model, contents, config } = req.body || {};

      // Nazwa modelu trafia do ścieżki URL po stronie SDK, więc nie może być
      // dowolnym ciągiem pochodzącym od klienta.
      if (typeof model !== "string" || !GEMINI_MODEL_PATTERN.test(model)) {
        return res.status(400).json({ error: "Nieprawidłowa nazwa modelu." });
      }
      if (contents === undefined || contents === null) {
        return res.status(400).json({ error: "Brak pola contents." });
      }

      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        console.warn("[Gemini] Brak GEMINI_API_KEY na serwerze.");
        return res.status(503).json({ error: "Usługa AI jest chwilowo niedostępna." });
      }

      const modelsToTry = Array.from(new Set([
        model,
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-3.7-flash'
      ]));

      let lastErr: any;
      for (const m of modelsToTry) {
        let retries = 2;
        while (retries > 0) {
          try {
            const ai = new GoogleGenAI({ apiKey });
            const response: any = await ai.models.generateContent({ model: m, contents, config });

            return res.json({
              text: response?.text ?? "",
              candidates: response?.candidates ?? [],
              modelUsed: m,
            });
          } catch (err: any) {
            lastErr = err;
            const errMsg = err?.message || String(err);
            const status = Number(err?.status);
            console.warn(`[Gemini Proxy] Model ${m} failed (status ${status || 'unknown'}, retries left ${retries - 1}):`, errMsg);

            const isRetryable = status === 503 || status === 429 || errMsg.includes('503') || errMsg.includes('429') || errMsg.toLowerCase().includes('demand') || errMsg.toLowerCase().includes('unavailable');
            if (isRetryable) {
              retries--;
              if (retries > 0) {
                await new Promise(r => setTimeout(r, 1200));
                continue;
              }
            }
            break; // Try next fallback model
          }
        }
      }

      throw lastErr;
    } catch (err: any) {
      console.error("[Gemini] proxy error:", err?.message || err);
      const status = Number(err?.status);
      return res
        .status(status >= 400 && status < 600 ? status : 503)
        .json({ error: formatErrorString(err) });
    }
  });

  // Trasy AI wymagają zalogowania.
  app.post("/api/openai", requireFirebaseAuth, handleOpenAI);
  app.post("/api/openai/generate", requireFirebaseAuth, handleOpenAI);
  app.post("/api/anthropic", requireFirebaseAuth, handleAnthropic);
  app.post("/api/anthropic/generate", requireFirebaseAuth, handleAnthropic);
  app.post("/api/deepseek", requireFirebaseAuth, handleDeepSeek);
  app.post("/api/deepseek/generate", requireFirebaseAuth, handleDeepSeek);

  // Blokada dla nieznanych tras /api, aby nie zwracały index.html (SPA)
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `Nie odnaleziono endpointu API: ${req.method} ${req.originalUrl || req.path}` });
  });

  return app;
}

async function startServer() {
  const app = await createApp();
  // Hostingi (Vercel, Render, Railway, Cloud Run) wstrzykują port przez
  // środowisko. Zaszyta trójka działa tylko lokalnie.
  // Lokalnie zawsze 3000 (w .env nie ma PORT, więc alternatywa i tak się nie
  // wykonuje). Na hostingu port jest narzucony przez środowisko i zignorowanie
  // go znaczy, że proces nasłuchuje pod innym numerem, niż platforma kieruje
  // ruch — aplikacja wstaje, ale nikt się do niej nie dobija.
  const PORT = Number(process.env.PORT) || 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    const handleDevHtml = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite?.ssrFixStacktrace(e as Error);
        next(e);
      }
    };
    app.get('/', handleDevHtml);
    app.get('{*all}', handleDevHtml);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.get('{*all}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      const altPort = PORT + 1;
      console.warn(`[Server] Port ${PORT} busy, starting on http://localhost:${altPort}`);
      app.listen(altPort, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${altPort}`);
      });
    } else {
      console.error('[Server] Startup error:', err);
    }
  });
}

// Uruchamiaj serwer wyłącznie przy bezpośrednim wywołaniu (node server.ts / tsx server.ts).
// W środowiskach serverless (Vercel, AWS Lambda) lub przy imporcie jako moduł, aplikacja
// jest eksportowana przez createApp() i zarządzana przez platformę.
const isDirectExecution = 
  !process.env.VERCEL && 
  !process.env.VERCEL_ENV && 
  !process.env.AWS_LAMBDA_FUNCTION_NAME &&
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs'));

if (isDirectExecution) {
  startServer().catch(console.error);
}
