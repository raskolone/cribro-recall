
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

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GoogleGenAI, Type } from "@google/genai";
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
  const models = customModels || [
    'openai/gpt-4o-mini',
    'gemini-2.5-flash'
  ];
  let lastError;
  const errors: string[] = [];
  
  for (const model of models) {
    let retries = 3;
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

        const sysInst = config?.systemInstruction || "";

        if (model.startsWith('openai')) {
           const apiKey = process.env.OPENAI_API_KEY;
           if (!apiKey) {
             console.warn("[Server] OPENAI_API_KEY not configured, skipping model");
             throw new Error("OPENAI_API_KEY not configured");
           }
           
           const targetModel = model.replace('openai/', '') || 'gpt-4o-mini';
           const isJsonMode = config?.responseMimeType === 'application/json';

           let finalPrompt = promptText;
           if (isJsonMode && !finalPrompt.toLowerCase().includes('json') && !sysInst.toLowerCase().includes('json')) {
             finalPrompt += '\n\nReturn output in valid JSON format.';
           }

           const bodyPayload: any = {
             model: targetModel,
             messages: [
               ...(sysInst ? [{ role: "system", content: sysInst }] : []),
               { role: "user", content: finalPrompt }
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
             console.error(`[Server] OpenAI API Error [${response.status}]:`, errText);
             throw new Error(`OpenAI API error (${response.status}): ${errText}`);
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
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
        } else if (String(err?.status) === "404" || (String(err?.status) === "400" && err?.message?.includes("not found"))) {
          break; // Next model
        } else {
          break; // Try next model on unknown errors
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
  return initializeApp(); // App Default Credentials
}

export async function createApp() {
  const app = express();
  
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
      
      // Admin emails
      const ADMIN_EMAILS = ['maciej.wyrozumski@gmail.com'];
      
      if (!decodedToken.email || !ADMIN_EMAILS.includes(decodedToken.email)) {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
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
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin-users/users', requireFirebaseAdmin, async (req, res) => {
    try {
      const { email, password, role } = req.body;
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email,
          password,
        });
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          userRecord = await adminAuth.getUserByEmail(email);
          await adminAuth.updateUser(userRecord.uid, { password });
        } else {
          throw authError;
        }
      }
      
      // Optionally set custom claims for role here
      if (role) {
        await adminAuth.setCustomUserClaims(userRecord.uid, { role });
      }
      res.json(userRecord);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin-users/users/:uid', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      await adminAuth.deleteUser(uid);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin-users/users/:uid/password', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      const { password } = req.body;
      await adminAuth.updateUser(uid, { password });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin-users/users/:uid/role', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      const { role } = req.body;
      await adminAuth.setCustomUserClaims(uid, { role });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // Proxy for Gemini API
  
app.post('/api/gemini/generate-test', requireFirebaseAdmin, async (req, res) => {
    try {
      const { level, testTitle, scope, studentProfile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, typeCounts, fileData, driveFile } = req.body;
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      const dummyKey = "dummy";
      
      
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

      
      // Dynamicznie generowane zasady dla typów zadań
      const typeRulesMap: Record<string, string> = {
        'translation': "- translation: 1 zadanie zbiorcze. W 'prompt' umieść N zdań polskich w punktach (1., 2., ...). Dodaj w nawiasie krótką wskazówkę, np. (past simple), aby kursant wiedział co zastosować. W 'correctAnswer' umieść N angielskich tłumaczeń w punktach (1., 2., ...).",
        'fill_in_blank': "- fill_in_blank: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO TEKSTU (np. krótka historyjka, opowiadanie). W 'prompt' umieść tekst z lukami '___', oznaczonymi numerami lub po prostu w tekście. W 'correctAnswer' umieść N poprawnych słów w punktach (1., 2., ...).",
        'fill_in_blank_bank': "- fill_in_blank_bank: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO TEKSTU (np. krótka historyjka). W 'wordBank' umieść słowa w rozsypce do wstawienia. W 'prompt' umieść tekst z lukami '___'. W 'correctAnswer' umieść N odpowiedzi.",
        'matching': "- matching: 1 zadanie zbiorcze. W 'options' zamieść listę wszystkich N par w formacie [\"słowo1 = word1\", \"słowo2 = word2\", ...].",
        'find_mistake': "- find_mistake: 1 zadanie zbiorcze. W 'prompt' umieść N zdań/punktów do poprawienia.",
        'multiple_choice': "- multiple_choice: 1 zadanie zbiorcze. W 'prompt' umieść JEDEN SPÓJNY TEKST z lukami '___', albo N pytań wielokrotnego wyboru, w zależności od kontekstu. Jeśli to test z gramatyki np. czasowniki, to krótka historyjka jest preferowana. Podaj opcje A/B/C.",
        'writing': "- writing: 1 zadanie z dłuższą wypowiedzią pisemną."
      };
      
      const activeTypes = selectedTypes || ['multiple_choice', 'fill_in_blank', 'fill_in_blank_bank', 'translation'];
      const activeRules = activeTypes.map((t: string) => typeRulesMap[t]).filter(Boolean).join('\n   ');

      let contents = [];
      const prompt = `Jesteś asystentem edukacyjnym, generatorem testów opartym o zaawansowany model.
Twoim zadaniem jest przygotowanie wysoce spersonalizowanego testu dla kursanta, analizując jego historię lekcji.

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

            let response = await generateContentWithRetry(ai, contents, {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.4
      });

      // Krok 2: Weryfikacja spójności logicznej testu
      const verificationPrompt = `Przeanalizuj poniższe wygenerowane zadania testowe w formacie JSON:
${response.text}

TWOJE ZADANIE: Sprawdź spójność logiczną i sens wygenerowanych pytań. Upewnij się, że zadania i odpowiedzi są naturalne, poprawne merytorycznie i nie zawierają sztucznego, robotycznego języka.
Jeśli to konieczne, popraw treść, aby była w 100% poprawna i praktyczna z punktu widzenia nauczania języka angielskiego.
Zwróć skorygowany wynik WYŁĄCZNIE jako poprawną tablicę JSON, zachowując dokładnie tę samą strukturę.`;

      response = await generateContentWithRetry(ai, [{ text: verificationPrompt }], {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.3
      });
        
      
      let parsed = [];
      try {
        let cleanText = response.text || '[]';
        cleanText = cleanText.replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
        parsed = JSON.parse(cleanText);
      } catch (e) {
        return res.status(500).json({ error: `Failed to parse AI response: ${response.text}` });
      }
      
      return res.json({ questions: parsed });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/import-lessons-batch', requireFirebaseAdmin, async (req, res) => {
    try {
      const { textContent, pdfBase64, driveFile, students, targetStudentId, targetStudentName } = req.body;
      if (!textContent && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: 'Missing textContent, pdfBase64 or driveFile' });
      }
      
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in environment variables.' });
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

Przeanalizuj CAŁĄ treść dokładnie i nie pomijaj żadnej lekcji. Zwróć wyłącznie poprawny obiekt JSON z tablicą "lessons".`;

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
        ['openai/gpt-4o-mini', 'gemini-2.5-flash']
      );

      const responseText = response.text;
      if (!responseText) throw new Error("No response from AI model");
      
      const json = JSON.parse(responseText);
      res.json(json);
    } catch (error: any) {
      console.error('Error in import-lessons-batch:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gemini/lesson-summary', requireFirebaseAdmin, async (req, res) => {
    try {
      const { notes, pdfBase64, driveFile, students } = req.body;
      if (!notes && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: 'Missing notes, pdfBase64 or driveFile' });
      }
      
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in environment variables.' });
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
                { text: `Baza kursantów:\n${studentsListStr}\n\nPowyżej znajduje się plik PDF z notatkami z lekcji. Przeanalizuj go.` }
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
            { text: `Baza kursantów:\n${studentsListStr}\n\nPowyżej znajduje się plik PDF z notatkami z lekcji. Przeanalizuj go.` }
          ]
        }];
      } else {
        promptContext = [{
          role: 'user',
          parts: [{ text: `Baza kursantów:\n${studentsListStr}\n\nTranskrypcja/Notatki ze spotkania:\n${notes}` }]
        }];
      }

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
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });
  // Proxy for Gemini API if we ever want to move Gemini to server-side
  // Right now, keeping what's there on Vite fallback for now.


  
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
Przeanalizuj każdą odpowiedź ucznia. Zwróć szczególną uwagę na zadania typu "writing" - wskaż błędy, ale też pochwal za dobre użycie struktur.
ZASADA INTERPUNKCJI: Pamiętaj, że interpunkcja (kropki, przecinki, wielkie litery) jest potrzebna i jest dobrą praktyką, ale NIE MOŻE obniżać oceny ani powodować odejmowania punktów.
Na koniec przyznaj łączną ocenę (np. w procentach lub punktach).

Zwróć JSON z polami:
- score (liczba, przyznane punkty całkowite)
- feedback (string, Twój szczegółowy feedback dla ucznia, z wylistowanymi błędami i poradami)
`;

      
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "Gemini API key not configured." });
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
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/gemini/student-stats-summary', requireFirebaseAuth, async (req, res) => {
    try {
      const { stats, logsSummary, language } = req.body;
      const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      const openaiApiKey = process.env.OPENAI_API_KEY;

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
      }, ['openai/gpt-4o-mini', 'gemini-3.6-flash', 'gemini-2.5-flash']);
      
      if (!response.text) throw new Error("No response from AI");
      
      let cleanText = response.text;
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
      res.json(JSON.parse(cleanText));
    } catch (err: any) {
      console.error("Error in student-stats-summary endpoint:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Text-to-Speech API (ElevenLabs proxy & fallback)
      const handleTTS = async (req: express.Request, res: express.Response) => {
    try {
      const text = (req.body?.text || req.query.text) as string;
      const lang = (req.body?.accent || req.body?.lang || req.query.lang || req.query.accent || 'US') as string;
      const isUK = lang === 'UK' || lang === 'en-GB' || lang === 'BrE';

      if (!text) {
        return res.status(400).json({ error: "Missing text parameter" });
      }

      // Format text: ensure punctuation at end
      const trimmedText = text.replace(/<[^>]+>/g, '').trim();
      const formattedText = /[.?!]$/.test(trimmedText) ? trimmedText : `${trimmedText}.`;

      // 1. GENERATE CACHE KEY & CHECK CACHE
      const crypto = await import('crypto');
      const hash = crypto.default.createHash('sha256').update(formattedText + '_' + (isUK ? 'UK' : 'US')).digest('hex');
      const fileName = `tts_cache/${hash}.mp3`;

      const hashInt = parseInt(hash.charAt(hash.length - 1), 16);
      const isMale = hashInt % 2 === 0;
      
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs/promises');
      const localCacheDir = path.join(os.tmpdir(), 'tts_cache');
      await fs.mkdir(localCacheDir, { recursive: true });
      const localFileName = path.join(localCacheDir, `${hash}.mp3`);

      // Check Local Cache First
      try {
        const localBuffer = await fs.readFile(localFileName);
        console.log('TTS Local Cache HIT:', hash);
        res.set({
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000'
        });
        return res.send(localBuffer);
      } catch (e) {
        // Not in local cache
      }

      let bucket: any = null;
      try {
        const { getStorage } = await import('firebase-admin/storage');
        const fbConfig = (await import('./firebase-applet-config.json', { with: { type: 'json' } })).default;
        const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || fbConfig.storageBucket || "gen-lang-client-0425391821.firebasestorage.app";
        if (bucketName) {
          bucket = getStorage().bucket(bucketName);
          const file = bucket.file(fileName);
          const [exists] = await file.exists();
          if (exists) {
            console.log('TTS Firebase Cache HIT:', fileName);
            const [audioBuffer] = await file.download();
            // save to local cache for next time
            fs.writeFile(localFileName, audioBuffer).catch(()=>{});
            res.set({
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=31536000'
            });
            return res.send(audioBuffer);
          }
        }
      } catch (err: any) {
        console.warn('Firebase Storage cache check warning:', err.message || err);
      }

      console.log('TTS Cache MISS. Generowanie audio...');
      let finalAudioBuffer: Buffer | null = null;

      // POZIOM 1: ElevenLabs
      const elevenLabsKey = process.env.VITE_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
      if (!finalAudioBuffer && elevenLabsKey) {
        let voiceId = "S9WrLrqYPJzmQyWPWbZ5";
        if (isUK) {
          voiceId = isMale ? "JBFqnCBcs6TWROtGMCA3" : "Xb7hH8MSALEjdAclc2Uj"; // George : Alice
        } else {
          voiceId = isMale ? "29vD33N1CtxCmqQRPOHJ" : "21m00Tcm4TlvDq8ikWAM"; // Drew : Rachel
        }
        try {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'xi-api-key': elevenLabsKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: formattedText,
              model_id: "eleven_multilingual_v2"
            })
          });
          if (response.ok) {
            finalAudioBuffer = Buffer.from(await response.arrayBuffer());
            console.log('TTS Poziom 1: ElevenLabs sukces');
          } else {
            const errTxt = await response.text();
            console.warn(`ElevenLabs API error: ${response.status} - ${errTxt.slice(0, 100)}`);
          }
        } catch (e: any) {
          console.warn('ElevenLabs API request failed:', e.message || e);
        }
      }

      // POZIOM 2: OpenAI TTS
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!finalAudioBuffer && openaiKey) {
        const voice = isUK ? (isMale ? "fable" : "shimmer") : (isMale ? "echo" : "nova");
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
              voice: voice
            })
          });
          if (response.ok) {
            finalAudioBuffer = Buffer.from(await response.arrayBuffer());
            console.log('TTS Poziom 2: OpenAI TTS sukces');
          } else {
            const errTxt = await response.text();
            console.warn(`OpenAI TTS API error: ${response.status} - ${errTxt.slice(0, 100)}`);
          }
        } catch (e: any) {
          console.warn('OpenAI TTS API request failed:', e.message || e);
        }
      }

      // POZIOM 3: Gemini / Google Cloud TTS
      const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!finalAudioBuffer && geminiKey) {
        try {
          const langCode = isUK ? 'en-GB' : 'en-US';
          const voiceName = isUK ? (isMale ? 'en-GB-Neural2-B' : 'en-GB-Neural2-A') : (isMale ? 'en-US-Neural2-D' : 'en-US-Neural2-F');
          
          const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text: formattedText },
              voice: { languageCode: langCode, name: voiceName },
              audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 }
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.audioContent) {
              finalAudioBuffer = Buffer.from(data.audioContent, 'base64');
              console.log('TTS Poziom 3: Google Cloud TTS sukces');
            }
          } else {
            console.warn(`GCP TTS API error: ${response.status}. Próba Gemini 3.1 Flash TTS...`);
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            const interaction = await ai.interactions.create({
              model: 'gemini-3.1-flash-tts-preview',
              input: formattedText,
              response_modalities: ['AUDIO'],
              generation_config: {
                speech_config: {
                  language: langCode.toLowerCase(),
                  voice: isUK ? (isMale ? "fenrir" : "zephyr") : (isMale ? "charon" : "kore")
                } as any
              }
            });
            for (const step of interaction.steps) {
              if (step.type === 'model_output') {
                const audioContent = step.content?.find(c => c.type === 'audio');
                if (audioContent && audioContent.data) {
                  finalAudioBuffer = Buffer.from(audioContent.data, 'base64');
                  console.log('TTS Poziom 3: Gemini TTS Flash sukces');
                }
              }
            }
          }
        } catch (e: any) {
          console.warn('Google Cloud / Gemini TTS request failed:', e.message || e);
        }
      }

      if (finalAudioBuffer) {
        // Save to cache asynchronously so we don't block the response
        fs.writeFile(localFileName, finalAudioBuffer).catch(() => {});
        
        if (bucket) {
          const file = bucket.file(fileName);
          file.save(finalAudioBuffer, {
            metadata: { contentType: 'audio/mpeg' }
          }).then(() => console.log('TTS zapisano w Firebase cache:', fileName))
            .catch((e: any) => console.warn('Nie udało się zapisać do cache Firebase:', e.message || e.code));
        }
        
        res.set({
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000'
        });
        return res.send(finalAudioBuffer);
      }

      return res.status(503).json({ error: 'Usługa TTS chwilowo niedostępna na wszystkich poziomach.' });
    } catch (error: any) {
      console.error('TTS error:', error.message || error);
      res.status(500).json({ error: error.message });
    }
  };
  app.get("/api/tts", handleTTS);
  app.post("/api/tts", handleTTS);

  // --- OPENAI API PROXIES ---
  const handleOpenAI = async (req: any, res: any) => {
    try {
      const { prompt, systemInstruction, isJson, messages, model } = req.body || {};
      if (!prompt && !messages) return res.status(400).json({ error: 'Missing prompt or messages' });

      const openaiKey = process.env.OPENAI_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

      let chatMessages = messages;
      if (!chatMessages) {
        chatMessages = [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
          { role: "user", content: prompt || "" }
        ];
      }

      const requestedModel = model ? String(model).replace('openai/', '') : null;
      const openAiModels = Array.from(new Set([
        requestedModel,
        "gpt-4o-mini",
        "gpt-4o",
        "gpt-4-turbo",
        "gpt-3.5-turbo"
      ].filter((m): m is string => Boolean(m))));
      let openAiSuccess = false;
      let resultText = "";
      let usedModel = "";

      if (openaiKey) {
        for (const modelName of openAiModels) {
          console.log(`OpenAI Fallback -> Przełączam na model: ${modelName}`);
          
          try {
            const bodyPayload: any = {
              model: modelName,
              messages: chatMessages,
              temperature: 0.7
            };

            if (isJson) {
              bodyPayload.response_format = { type: "json_object" };
              const sysInstStr = systemInstruction ? String(systemInstruction).toLowerCase() : "";
              const promptStr = String(prompt || "").toLowerCase();
              if (!sysInstStr.includes('json') && !promptStr.includes('json')) {
                bodyPayload.messages = [
                  ...bodyPayload.messages,
                  { role: "system", content: "You must respond in valid JSON format." }
                ];
              }
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
              if (response.status === 401 || response.status === 429 || errText.includes('insufficient_quota') || errText.includes('rate_limit')) {
                console.warn("OpenAI API key invalid or out of quota/rate-limited. Skipping remaining OpenAI models.");
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

      // Ultimate Fallback to Gemini 2.5 Flash
      console.log("OpenAI Fallback -> Przełączam na model: gemini-2.5-flash. Key present:", Boolean(geminiKey));
      if (geminiKey) {
        let gRetries = 3;
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
              model: "gemini-2.5-flash",
              contents: fullPrompt,
              config: geminiConfig
            });

            if (geminiRes.text) {
              return res.json({ text: geminiRes.text, modelUsed: "gemini-2.5-flash" });
            }
          } catch (gErr: any) {
            console.warn(`Gemini fallback exception (retries left ${gRetries - 1}):`, gErr?.message || gErr);
            gRetries--;
            if (gRetries > 0) {
              await new Promise(r => setTimeout(r, 1500));
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

  app.post("/api/openai", optionalFirebaseAuth, handleOpenAI);
  app.post("/api/openai/generate", optionalFirebaseAuth, handleOpenAI);

  return app;
}

async function startServer() {
  const app = await createApp();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(console.error);
}
