import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GoogleGenAI, Type } from "@google/genai";

async function generateContentWithRetry(aiClient: any, contents: any, config: any) {
  const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite'];
  let lastError;
  
  for (const model of models) {
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`[Server] Attempting generation with ${model}... (retries left: ${retries})`);
        
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
      } catch (err: any) {
        console.warn(`[Server] Model ${model} failed:`, err?.status || err?.message);
        lastError = err;
        
        if (err?.message?.includes("timed out")) {
          break; // Next model immediately on timeout
        } else if (String(err?.status) === "429" && err?.message?.includes("Quota exceeded for metric")) {
          console.warn("[Server] Quota exceeded, switching model immediately");
          break; // Next model immediately
        } else if (String(err?.status) === "503" || String(err?.status) === "429" || err?.message?.includes("503") || err?.message?.includes("429")) {
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
  throw lastError;
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

async function startServer() {
  const app = express();
  const PORT = 3000;
  
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
  async function requireFirebaseAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }
    
    const idToken = authHeader.slice(7);
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      (req as any).userUid = decodedToken.uid;
      (req as any).userEmail = decodedToken.email;
      next();
    } catch (err) {
      console.error(err);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  async function requireFirebaseAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }
    
    const idToken = authHeader.slice(7);
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
    } catch (err) {
      console.error(err);
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
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured' });
      
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
   ZABRANIA SIĘ TWORZENIA ZADAŃ INNEGO TYPU.
   Zasady dla typów zadań zbiorczych:
   - translation: 1 zadanie zbiorcze. W 'prompt' umieść N zdań polskich w punktach (1., 2., ...). W 'correctAnswer' umieść N angielskich tłumaczeń w punktach (1., 2., ...).
   - fill_in_blank: 1 zadanie zbiorcze. W 'prompt' umieść N zdań z lukami '___' w punktach (1., 2., ...). W 'correctAnswer' umieść N poprawnych słów w punktach.
   - fill_in_blank_bank: 1 zadanie zbiorcze. W 'wordBank' umieść słowa w rozsypce dla wszystkich N zdań. W 'prompt' umieść N zdań z lukami '___' w punktach (1., 2., ...). W 'correctAnswer' umieść N odpowiedzi.
   - matching: 1 zadanie zbiorcze. W 'options' zamieść listę wszystkich N par w formacie ["słowo1 = word1", "słowo2 = word2", ...].
   - find_mistake: 1 zadanie zbiorcze. W 'prompt' umieść N zdań/punktów do poprawienia.
   - multiple_choice: 1 zadanie zbiorcze. W 'prompt' umieść N pytań wielokrotnego wyboru (1. ..., 2. ...).
   - writing: 1 zadanie z dłuższą wypowiedzią pisemną.

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
        
      
      let parsed = [];
      try {
        parsed = JSON.parse(response.text || '[]');
      } catch (e) {
        return res.status(500).json({ error: 'Failed to parse AI response' });
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
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const studentsListStr = students ? students.map((s: any) => `ID: ${s.id} | Imię/Nazwisko: ${s.name} | Poziom: ${s.level} | Opis: ${s.description}`).join('\n') : 'Brak bazy kursantów';

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
1. Zidentyfikuj kursanta (studentId) dla KAŻDEJ lekcji na podstawie podanej bazy kursantów (imienia, nazwiska lub opisu widocznego w pliku). 
2. Podziel dokument na logiczne bloki odpowiadające pojedynczym lekcjom.
3. Przeanalizuj inteligentnie każdą lekcję i przypisz jej fragmenty do odpowiednich kategorii w systemie.

# Wygeneruj wynik w formacie JSON
Zwróć wynik jako JSON z tablicą obiektów o polu "lessons". Każdy obiekt lekcji musi zawierać szczegółowe dane:
- date (string): Data lekcji w formacie YYYY-MM-DD. Poszukaj daty w tekście (np. "12 marca", "12.03.2024"). Jeśli absolutnie brak, wygeneruj dzisiejszą.
- studentId (string): ID wybranego kursanta dopasowanego z bazy.
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
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const studentsListStr = students ? students.map((s: any) => `ID: ${s.id} | Imię/Nazwisko: ${s.name} | Poziom: ${s.level} | Opis: ${s.description}`).join('\n') : 'Brak bazy kursantów';

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
Zidentyfikuj kursanta, którego dotyczy lekcja na podstawie podanej bazy kursantów i dopasuj studentId. Dostosuj poziom języka i szczegółowość treści do profilu wybranego kursanta.

# Wygeneruj wynik w formacie JSON
Zwróć wynik jako JSON z poniższymi polami:
- studentId (string, ID wybranego kursanta z Bazy Kursantów, jeśli nie potrafisz dopasować zostaw puste)
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
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured' });
      
      const ai = new GoogleGenAI({ apiKey });
      
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

      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      
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
                stability: 0.75,
                similarity_boost: 0.85,
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
      const googleTranslateUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(formattedText)}&tl=${lang.startsWith('en') ? lang : 'en'}&client=tw-ob`;
      
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

startServer().catch(console.error);
