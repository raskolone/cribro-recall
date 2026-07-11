import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { GoogleGenAI, Type, Schema } from "@google/genai";

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

  // Authentication Middleware
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
  app.get('/api/firebase-admin/users', requireFirebaseAdmin, async (req, res) => {
    try {
      const listUsersResult = await adminAuth.listUsers(1000);
      res.json(listUsersResult.users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/firebase-admin/users', requireFirebaseAdmin, async (req, res) => {
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

  app.delete('/api/firebase-admin/users/:uid', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      await adminAuth.deleteUser(uid);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/firebase-admin/users/:uid/password', requireFirebaseAdmin, async (req, res) => {
    try {
      const uid = req.params.uid as string;
      const { password } = req.body;
      await adminAuth.updateUser(uid, { password });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/firebase-admin/users/:uid/role', requireFirebaseAdmin, async (req, res) => {
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

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: contents,
        config: {
          systemInstruction: sysInstruction,
          responseMimeType: "application/json",
          responseSchema: {
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
          }
        }
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
            promptContext = [
              { text: `Baza kursantów:\n${studentsListStr}\n\nTranskrypcja/Notatki ze spotkania (Google Docs / Text):\n${text}` }
            ];
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
        promptContext = [
          { text: `Baza kursantów:\n${studentsListStr}\n\nTranskrypcja/Notatki ze spotkania:\n${notes}` }
        ];
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

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptContext,
        config: {
          systemInstruction: sysInstruction,
          responseMimeType: "application/json",
          responseSchema: {
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
          }
        }
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


  // Text-to-Speech API
  app.get("/api/tts", async (req, res) => {
    try {
      const text = req.query.text as string;
      const lang = req.query.lang as string; // 'en-US' or 'en-GB'
      if (!text) {
        return res.status(400).json({ error: "Missing text parameter" });
      }

      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      
      // If ElevenLabs API key is present, use it
      if (elevenLabsKey) {
        // Voice selection based on language
        let voiceId = 'cgSgspJ2msm6clMCkdW9'; // Default to Jessica (US)
        
        const usVoices = ['EXAVITQu4vr4xnSDxMaL', 'cgSgspJ2msm6clMCkdW9', '21m00Tcm4TlvDq8ikWAM'];
        const gbVoices = ['Xb7hH8MSUJpSbSDYk0k2', 'CYw3kZ02Hs0563khs1Fj', 'JBFqnCBsd6RMkjVDRZzb'];
        const auVoices = ['IKne3meq5aSn9XLyUdCD', 'ZQe5CZNOzWyzPSCn5a3c'];
        const sctVoices = ['D38z5RcWu1voky8WS1ja', 'N2lVS1w4EtoT3dr4eOWO'];

        if (lang === 'en-GB') {
          voiceId = gbVoices[Math.floor(Math.random() * gbVoices.length)];
        } else if (lang === 'en-AU') {
          voiceId = auVoices[Math.floor(Math.random() * auVoices.length)];
        } else if (lang === 'en-SCT') {
          voiceId = sctVoices[Math.floor(Math.random() * sctVoices.length)];
        } else if (lang === 'en-US') {
          voiceId = usVoices[Math.floor(Math.random() * usVoices.length)];
        }

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': elevenLabsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        res.set({
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000'
        });
        res.send(Buffer.from(audioBuffer));
        return;
      }

      // Fallback to Google Translate TTS
      const googleTranslateUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang || 'en'}&client=tw-ob`;
      
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
  });

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
