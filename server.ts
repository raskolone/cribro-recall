import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GoogleGenAI, Type } from "@google/genai";

async function generateContentWithRetry(aiClient: any, contents: any, config: any, customModels?: string[]) {
  const models = customModels || [
    'openai/gpt-4o-mini',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
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
            if (c.inlineData) return "[Załączono plik, który nie może być bezpośrednio przetworzony jako tekst]";
            return JSON.stringify(c);
          }).join('\n');
        } else if (contents && contents.parts) {
          promptText = contents.parts.map((p: any) => {
            if (typeof p === 'string') return p;
            if (p.text) return p.text;
            if (p.inlineData) return "[Załączono plik, który nie może być bezpośrednio przetworzony jako tekst]";
            return JSON.stringify(p);
          }).join('\n');
        } else if (contents && typeof contents === 'object' && contents.text) {
          promptText = contents.text;
        } else {
          promptText = JSON.stringify(contents);
        }

        const sysInst = config?.systemInstruction || "";

        if (model.startsWith('openai')) {
           const apiKey = process.env.VITE_OPENAI_API_KEY;
           if (!apiKey) {
             console.warn("[Server] VITE_OPENAI_API_KEY not configured, skipping model");
             throw new Error("VITE_OPENAI_API_KEY not configured");
           }
           
           const targetModel = model.replace('openai/', '');
           const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: targetModel,
              messages: [
                ...(sysInst ? [{ role: "system", content: sysInst }] : []),
                { role: "user", content: promptText }
              ],
              temperature: config?.temperature || 0.7,
              ...(config?.responseMimeType === 'application/json' && config?.responseSchema?.type === Type.OBJECT ? { response_format: { type: "json_object" } } : {})
            })
           });

           if (!response.ok) {
             const errText = await response.text();
             throw new Error(`OpenAI API error: ${response.statusText} - ${errText}`);
           }
           const data = await response.json();
           return { text: data.choices?.[0]?.message?.content || "" };

        } else if (model.startsWith('deepseek')) {
           const apiKey = process.env.VITE_DEEPSEEK_API_KEY;
           if (!apiKey) {
             console.warn("[Server] VITE_DEEPSEEK_API_KEY not configured, skipping model");
             throw new Error("VITE_DEEPSEEK_API_KEY not configured");
           }
           
           const isReasoner = model === 'deepseek-reasoner';
           const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                ...(sysInst && !isReasoner ? [{ role: "system", content: sysInst }] : []),
                { role: "user", content: (isReasoner && sysInst ? sysInst + "\n\n" : "") + promptText }
              ],
              temperature: isReasoner ? 0.6 : (config?.temperature || 0.7)
            })
           });

           if (!response.ok) throw new Error(`DeepSeek API error: ${response.statusText}`);
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
  
  app.post('/api/deepseek/generate-test', requireFirebaseAdmin, async (req, res) => {
    try {
      const { level, testTitle, scope, studentProfile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, typeCounts, fileData, driveFile } = req.body;
      const apiKey = process.env.VITE_DEEPSEEK_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'VITE_DEEPSEEK_API_KEY not configured.' });
      
      let typeBreakdownInstruction = '';
      if (typeCounts && typeof typeCounts === 'object' && Object.keys(typeCounts).length > 0) {
        const parts = Object.entries(typeCounts)
          .filter(([t]) => !selectedTypes || selectedTypes.includes(t))
          .map(([type, count]) => `- ${type}: DOKŁADNIE 1 ZADANIE ZBIORCZE zawierające ${count} przykładów/zdań w bullet pointach`);
        if (parts.length > 0) {
          typeBreakdownInstruction = `STRUKTURA ZADAŃ W TESTU (GŁÓWNA ZASADA GRUPOWANIA):\n${parts.join('\n')}\nKażdy z wybranych typów ma stanowić DOKŁADNIE JEDNO POJEDYNCZE ZADANIE ZBIORCZE z wybraną liczbą przykładów! Łączna liczba obiektów w tablicy pytań ma wynosić DOKŁADNIE ${selectedTypes ? selectedTypes.length : 1} (po jednym obiekcie dla każdego wybranego typu).`;
        }
      }
      
      const typeRulesMap = {
        'translation': "- translation: 1 zadanie zbiorcze. W 'prompt' umieść N zdań polskich w punktach (1., 2., ...). Dodaj w nawiasie krótką wskazówkę, np. (past simple). W 'correctAnswer' umieść N angielskich tłumaczeń w punktach (1., 2., ...).",
        'fill_in_blank': "- fill_in_blank: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO TEKSTU (np. krótka historyjka). W 'prompt' umieść tekst z lukami '___'. W 'correctAnswer' umieść N poprawnych słów w punktach (1., 2., ...).",
        'fill_in_blank_bank': "- fill_in_blank_bank: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO TEKSTU. W 'wordBank' umieść słowa w rozsypce do wstawienia. W 'prompt' umieść tekst z lukami '___'. W 'correctAnswer' umieść N odpowiedzi.",
        'matching': "- matching: 1 zadanie zbiorcze. W 'options' zamieść listę wszystkich N par w formacie [\"słowo1 = word1\", \"słowo2 = word2\", ...].",
        'find_mistake': "- find_mistake: 1 zadanie zbiorcze. W 'prompt' umieść N zdań do poprawienia.",
        'multiple_choice': "- multiple_choice: 1 zadanie zbiorcze. W 'prompt' umieść teksty z lukami lub pytania wielokrotnego wyboru. Podaj opcje A/B/C.",
        'writing': "- writing: 1 zadanie z dłuższą wypowiedzią pisemną."
      };
      
      const activeTypes = selectedTypes || ['multiple_choice', 'fill_in_blank', 'fill_in_blank_bank', 'translation'];
      const activeRules = activeTypes.map((t) => typeRulesMap[t]).filter(Boolean).join('\n   ');

      const prompt = `Jesteś asystentem edukacyjnym. Tworzysz wysoce spersonalizowany test dla kursanta na poziomie ${level || 'nieokreślony'}.
      
Tytuł/Tematyka: ${testTitle || 'Brak tytułu'}
Zakres wytycznych: ${scope || 'Ogólne sprawdzenie wiedzy'}
Kontekst i hobby ucznia: ${studentProfile || 'Brak specjalnych informacji'}
Ostatnia lekcja: ${lessonContext || 'Brak'}
Wcześniejsze lekcje: ${allLessonsContext || 'Brak'}
Ogólna ilość zadań (grup): ${tasksCount || 10}

${typeBreakdownInstruction}

ZASADY:
${activeRules}

MUSISZ ZWRÓCIĆ WYŁĄCZNIE POPRAWNY JSON z jedną główną strukturą zawierającą tablicę 'questions'.
Struktura pojedynczego pytania (obiektu):
{
  "type": "string - jeden z: multiple_choice, fill_in_blank, fill_in_blank_bank, translation, matching, writing, find_mistake",
  "instruction": "Krótka instrukcja po polsku",
  "prompt": "Treść polecenia, tekst z lukami, wypunktowane zdania polskie itp.",
  "options": ["Opcja A", "Opcja B", ...] (tylko tam gdzie potrzebne),
  "wordBank": ["slowo1", "slowo2", ...] (tylko dla fill_in_blank_bank),
  "correctAnswer": "Prawidłowa odpowiedź (wypunktowana lista 1. ... 2. ... dla zadań wielokrotnych, konkretny klucz dla zamkniętych)",
  "points": 1
}

Zwróć format jako:
{
  "questions": [
     { "type": "...", ... }
  ]
}
`;

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content || "";
      
      const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
      const match = text.match(jsonBlockRegex);
      let jsonText = match && match[1] ? match[1].trim() : text;
      
      const parsed = JSON.parse(jsonText);
      res.json({ questions: parsed.questions || parsed });
    } catch (error) {
      console.error('DeepSeek generate test error:', error);
      res.status(500).json({ error: error.message || 'Error generating test' });
    }
  });

app.post('/api/gemini/generate-test', requireFirebaseAdmin, async (req, res) => {
    try {
      const { level, testTitle, scope, studentProfile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, typeCounts, fileData, driveFile } = req.body;
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in environment variables.' });
      
      const ai = new GoogleGenAI({ apiKey });
      
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
      const { textContent, pdfBase64, driveFile, students } = req.body;
      if (!textContent && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: 'Missing textContent, pdfBase64 or driveFile' });
      }
      
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in environment variables.' });
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const studentsListStr = typeof students === 'string' 
        ? students 
        : (Array.isArray(students) 
            ? students.map((s: any) => `ID: ${s.id} | Imię/Nazwisko: ${s.name || s.username || ''} | Poziom: ${s.level || ''} | Opis: ${s.description || ''}`).join('\n')
            : 'Brak bazy kursantów');

      let contents: any[] = [];
      
      if (driveFile) {
        const url = driveFile.mimeType === 'application/pdf' 
          ? `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media`
          : `https://www.googleapis.com/drive/v3/files/${driveFile.id}/export?mimeType=text/plain`;
          
        const res = await fetch(url, { headers: { Authorization: `Bearer ${driveFile.token}` } });
        if (!res.ok) throw new Error("Failed to fetch from Google Drive: " + await res.text());
        
        if (driveFile.mimeType === 'application/pdf') {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            contents = [{
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: buffer.toString('base64'),
                    mimeType: 'application/pdf'
                  }
                },
                { text: `Baza kursantów:\n${studentsListStr}\n\nPowyżej znajduje się plik PDF z historią lekcji. Przeanalizuj go.` }
              ]
            }];
        } else {
            const text = await res.text();
            contents = [{
              role: 'user',
              parts: [
                { text: `Baza kursantów:\n${studentsListStr}\n\nTreść historii lekcji (Google Docs / Text):\n${text}` }
              ]
            }];
        }
      } else if (pdfBase64) {
        contents = [{
          role: 'user',
          parts: [
            {
              inlineData: {
                data: pdfBase64.split(',')[1] || pdfBase64,
                mimeType: 'application/pdf'
              }
            },
            { text: `Baza kursantów:\n${studentsListStr}\n\nPowyżej znajduje się plik PDF z historią lekcji. Przeanalizuj go.` }
          ]
        }];
      } else {
        contents = [{
          role: 'user',
          parts: [
            { text: `Baza kursantów:\n${studentsListStr}\n\nTreść historii lekcji (Google Docs / Text):\n${textContent}` }
          ]
        }];
      }

      const sysInstruction = `# Cel
Na podstawie dostarczonego pliku PDF lub tekstu zawierającego historię lekcji jednego lub wielu kursantów, DOKŁADNIE wyodrębnij wszystkie poszczególne lekcje.
Plik może zawierać wiele lekcji ułożonych chronologicznie lub według numerów. Twoim zadaniem jest znalezienie KAŻDEJ lekcji i wyciągnięcie z niej maksimum informacji.

# Zanim wygenerujesz
1. Zidentyfikuj kursanta lub kursantów (studentIds / studentId) dla KAŻDEJ lekcji na podstawie podanej bazy kursantów (imienia, nazwiska lub opisu widocznego w pliku). Jeśli lekcja jest dla grupy kursantów, dopasuj wszystkich w podanej tablicy studentIds.
2. Podziel dokument na logiczne bloki odpowiadające pojedynczym lekcjom.
3. Przeanalizuj inteligentnie każdą lekcję i przypisz jej fragmenty do odpowiednich kategorii w systemie.

# Wygeneruj wynik w formacie JSON
Zwróć wynik jako JSON z tablicą obiektów o polu "lessons". Każdy obiekt lekcji musi zawierać szczegółowe dane:
- date (string): Data lekcji w formacie YYYY-MM-DD. Poszukaj daty w tekście (np. "12 marca", "12.03.2024"). Jeśli absolutnie brak, wygeneruj dzisiejszą.
- studentId (string): ID wybranego głównego kursanta dopasowanego z bazy.
- studentIds (array of strings): Lista ID wszystkich dopasowanych kursantów dla danej lekcji (np. przy zajęciach grupowych).
- lessonTopic (string): Krótki temat lekcji (max 50 znaków), wywnioskowany z treści.
- revisionNotes (string): Główne notatki, zagadnienia gramatyczne i tematy poruszane na lekcji.
- vocabularyText (string): Wyodrębnione nowe słówka, zwroty i ich tłumaczenia (najlepiej w formie 'angielski - polski').
- studentSpeaking (string): O czym mówił kursant, jakich argumentów używał, jego opinie (np. 'Mówił o swoich wakacjach w Hiszpanii...').
- thingsToImprove (string): Błędy gramatyczne, wymowa, rzeczy do poprawy na przyszłość.
- suggestedFollowUp (string): Zadanie domowe, sugestie co zrobić na następnej lekcji.

Bądź dokładny. Wykorzystaj całą dostępną treść, nie pomijaj lekcji.`;

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
              required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText"]
            }
          }
        },
        required: ["lessons"]
      };
      
      let response = await generateContentWithRetry(ai, contents, {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      });

      const responseText = response.text;
      if (!responseText) throw new Error("No response from Gemini");
      
      const json = JSON.parse(responseText);
      res.json(json);
    } catch (error: any) {
      console.error(error);
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

      const ai = new GoogleGenAI({ apiKey });
      
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
- vocabularyText (string, Słownictwo i wymowa z lekcji. Zasada formatowania: każde słowo i jego definicja (lub wymowa) mają być w osobnej linijce, oddzielone myślnikiem. Np. "word - tłumaczenie" i w następnej linii kolejne słowo)
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
Na koniec przyznaj łączną ocenę (np. w procentach lub punktach).

Zwróć JSON z polami:
- score (liczba, przyznane punkty całkowite)
- feedback (string, Twój szczegółowy feedback dla ucznia, z wylistowanymi błędami i poradami)
`;

      const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
      if (deepseekKey) {
        for (const dsModel of ['deepseek-reasoner', 'deepseek-chat']) {
          try {
            const isReasoner = dsModel === 'deepseek-reasoner';
            const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${deepseekKey}`
              },
              body: JSON.stringify({
                model: dsModel,
                messages: [
                  { role: "system", content: "Jesteś nauczycielem języka angielskiego. Zwróć wyłącznie poprawny JSON z polami score (number) i feedback (string)." },
                  { role: "user", content: prompt }
                ],
                temperature: isReasoner ? 0.6 : 0.7
              })
            });
            if (dsRes.ok) {
              const dsData = await dsRes.json();
              const textContent = dsData.choices?.[0]?.message?.content || "";
              const match = textContent.match(/\{[\s\S]*\}/);
              if (match) {
                const parsed = JSON.parse(match[0]);
                if (typeof parsed.score === 'number' && typeof parsed.feedback === 'string') {
                  return res.json(parsed);
                }
              }
            }
          } catch (dsErr) {
            console.warn(`DeepSeek ${dsModel} grade-test failed:`, dsErr);
          }
        }
      }

      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in environment variables.' });
      
      const ai = new GoogleGenAI({ apiKey });
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
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in environment variables.' });
      
      const ai = new GoogleGenAI({ apiKey });
      
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
      });
      
      if (!response.text) throw new Error("No response from AI");
      res.json(JSON.parse(response.text));
    } catch (err: any) {
      console.error("Error in student-stats-summary endpoint:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Text-to-Speech API (ElevenLabs proxy & fallback)
  const handleTTS = async (req: express.Request, res: express.Response) => {
    try {
      const text = (req.body?.text || req.query.text) as string;
      const lang = (req.body?.accent || req.body?.lang || req.query.lang || req.query.accent || 'en-US') as string;
      const customVoiceId = req.body?.voice_id || req.body?.voiceId;

      if (!text) {
        return res.status(400).json({ error: "Missing text parameter" });
      }

      // Format text: ensure punctuation at end
      const trimmedText = text.replace(/<[^>]+>/g, '').trim();
      const formattedText = /[.?!]$/.test(trimmedText) ? trimmedText : `${trimmedText}.`;

      // Voice mapping
      let voiceId = "S9WrLrqYPJzmQyWPWbZ5"; // Default en-US / AmE
      if (customVoiceId) {
        voiceId = customVoiceId;
      } else if (lang === 'en-GB' || lang === 'BrE') {
        voiceId = "NbkKnEAZ7Bqw4EAkVEaz"; // en-GB / BrE
      } else {
        voiceId = "S9WrLrqYPJzmQyWPWbZ5"; // en-US / AmE
      }

      const elevenLabsKey = process.env.VITE_ELEVENLABS_API_KEY;
      
      if (elevenLabsKey) {
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
              model_id: "eleven_turbo_v2_5",
              voice_settings: {
                stability: 0.85,
                similarity_boost: 0.88,
                style: 0.0,
                use_speaker_boost: true
              }
            })
          });

          if (response.ok) {
            const audioBuffer = await response.arrayBuffer();
            res.set({
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=31536000'
            });
            return res.send(Buffer.from(audioBuffer));
          } else {
            const errorText = await response.text();
            console.warn(`ElevenLabs API returned ${response.status}: ${errorText}, falling back to Google TTS`);
          }
        } catch (elError) {
          console.warn('ElevenLabs request failed, falling back to Google TTS:', elError);
        }
      }

      // Fallback to Google Translate TTS
      const googleTranslateUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(formattedText)}&tl=${lang.startsWith('en') ? 'en' : (lang === 'pl' ? 'pl' : lang)}&client=tw-ob`;
      
      const response = await fetch(googleTranslateUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Google Translate TTS error: ${response.status}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000'
      });
      res.send(Buffer.from(audioBuffer));
    } catch (error: any) {
      console.error('TTS error:', error);
      res.status(500).json({ error: error.message });
    }
  };

  app.get("/api/tts", handleTTS);
  app.post("/api/tts", handleTTS);

  // --- OPENAI API PROXIES ---
  app.post("/api/openai/generate", optionalFirebaseAuth, async (req, res) => {
    try {
      const { prompt, systemInstruction, model } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      const openaiKey = process.env.VITE_OPENAI_API_KEY;
      if (!openaiKey) {
        return res.status(500).json({ error: 'No OpenAI API key configured (VITE_OPENAI_API_KEY is missing).' });
      }

      const targetModel = model || 'gpt-4o-mini';

      const bodyPayload: any = {
        model: targetModel,
        messages: [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        if (content) {
          return res.json({ text: content, modelUsed: targetModel });
        } else {
          return res.status(500).json({ error: 'Empty response from OpenAI' });
        }
      } else {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        return res.status(response.status).json({ error: errorText });
      }
    } catch (err: any) {
      console.error('OpenAI exception:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- DEEPSEEK / OPENROUTER / GROQ API PROXIES ---
  app.post("/api/deepseek/generate", optionalFirebaseAuth, async (req, res) => {
    try {
      const { prompt, systemInstruction, model } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY || 'sk-9cd552056ba845e69ad063d53200fbcd';
      const openrouterKey = process.env.VITE_OPENROUTER_API_KEY;
      const groqKey = process.env.VITE_GROQ_API_KEY;

      if (!deepseekKey && !openrouterKey && !groqKey) {
        return res.status(500).json({ error: 'No AI provider API key configured (VITE_DEEPSEEK_API_KEY, VITE_OPENROUTER_API_KEY, or VITE_GROQ_API_KEY).' });
      }

      let lastErrorText = '';

      // 1. Try Direct DeepSeek API if key available
      if (deepseekKey) {
        const preferredModels = model 
          ? [model, model === 'deepseek-reasoner' ? 'deepseek-chat' : 'deepseek-reasoner']
          : ['deepseek-chat', 'deepseek-reasoner'];

        for (const targetModel of preferredModels) {
          try {
            const isReasoner = targetModel === 'deepseek-reasoner';
            const bodyPayload: any = {
              model: targetModel,
              messages: [
                ...(systemInstruction && !isReasoner ? [{ role: "system", content: systemInstruction }] : []),
                { role: "user", content: (isReasoner && systemInstruction ? systemInstruction + "\n\n" : "") + prompt }
              ],
              temperature: isReasoner ? 0.6 : 0.7
            };

            const response = await fetch("https://api.deepseek.com/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${deepseekKey}`
              },
              body: JSON.stringify(bodyPayload)
            });

            if (response.ok) {
              const data = await response.json();
              const content = data.choices?.[0]?.message?.content || "";
              if (content) {
                return res.json({ text: content, modelUsed: targetModel });
              }
            } else {
              lastErrorText = await response.text();
              console.warn(`DeepSeek Direct (${targetModel}) failed [${response.status}]:`, lastErrorText);
            }
          } catch (mErr: any) {
            console.warn(`DeepSeek model ${targetModel} exception:`, mErr?.message);
            lastErrorText = mErr?.message || String(mErr);
          }
        }
      }

      // 2. Try OpenRouter API if key available
      if (openrouterKey) {
        try {
          const bodyPayload: any = {
            model: "deepseek/deepseek-chat",
            messages: [
              ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
              { role: "user", content: prompt }
            ]
          };

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openrouterKey}`,
              "HTTP-Referer": "https://cribro-recall.app",
              "X-Title": "Cribro Recall"
            },
            body: JSON.stringify(bodyPayload)
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";
            if (content) {
              return res.json({ text: content, modelUsed: "openrouter/deepseek-chat" });
            }
          } else {
            lastErrorText = await response.text();
            console.warn(`OpenRouter failed [${response.status}]:`, lastErrorText);
          }
        } catch (orErr: any) {
          console.warn("OpenRouter exception:", orErr?.message);
          lastErrorText = orErr?.message || String(orErr);
        }
      }

      // 3. Try Groq API if key available
      if (groqKey) {
        try {
          const bodyPayload: any = {
            model: "llama-3.3-70b-versatile",
            messages: [
              ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
              { role: "user", content: prompt }
            ]
          };

          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${groqKey}`
            },
            body: JSON.stringify(bodyPayload)
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";
            if (content) {
              return res.json({ text: content, modelUsed: "groq/llama-3.3-70b" });
            }
          } else {
            lastErrorText = await response.text();
            console.warn(`Groq failed [${response.status}]:`, lastErrorText);
          }
        } catch (gErr: any) {
          console.warn("Groq exception:", gErr?.message);
          lastErrorText = gErr?.message || String(gErr);
        }
      }

      return res.status(500).json({ error: 'Primary AI providers (DeepSeek / OpenRouter / Groq) failed', details: lastErrorText });
    } catch (error: any) {
      console.error('AI provider proxy error:', error);
      res.status(500).json({ error: error.message });
    }
  });

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
