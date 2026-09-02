import { GoogleGenAI } from "@google/genai";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Wariant serverless trasy /api/openai (wdrożenie na Vercelu).
 *
 * Musi pilnować dostępu dokładnie tak samo jak odpowiednik w server.ts:
 * to endpoint wołający płatne modele, więc bez weryfikacji tokenu dowolny
 * adres w internecie generowałby treści na rachunek właściciela projektu.
 */
function getAdminApp() {
  if (getApps().length > 0) return getApp();
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    try {
      return initializeApp({ credential: cert(JSON.parse(serviceAccountStr)) });
    } catch {
      console.warn('[Firebase Admin] Nie udało się odczytać konta usługi');
    }
  }
  return initializeApp();
}

function mapToActualOpenAIModel(modelName: string): string {
  const clean = String(modelName || '').replace(/^openai\//, '').trim().toLowerCase();
  if (clean === 'gpt-5.6-luna' || clean === 'gpt-5.6' || clean.includes('luna')) {
    // GPT 5.6 Luna represents the flagship OpenAI intelligence tier - map to latest flagship endpoint
    return 'gpt-4o';
  }
  if (clean.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (clean.includes('gpt-4o')) return 'gpt-4o';
  if (clean.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (clean.includes('gpt-4')) return 'gpt-4';
  if (clean.includes('gpt-3.5-turbo') || clean.includes('gpt-3.5')) return 'gpt-3.5-turbo';
  return 'gpt-4o-mini';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers?.authorization;
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken || idToken === 'null' || idToken === 'undefined') {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }
  try {
    await getAuth(getAdminApp()).verifyIdToken(idToken);
  } catch (err: any) {
    console.warn('Auth token verification failed:', err?.message || err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const { prompt, systemInstruction, isJson, messages, model } = req.body || {};
    if (!prompt && !messages) {
      return res.status(400).json({ error: 'Missing prompt or messages' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

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

    const requestedModel = model ? String(model).replace('openai/', '') : null;
    const openAiModels = Array.from(new Set([
      requestedModel,
      "gpt-5.6-luna",
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
              console.warn("OpenAI API key invalid or out of quota. Skipping remaining OpenAI models.");
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
      return res.status(200).json({ text: resultText, modelUsed: usedModel });
    }

    // Ultimate Fallback to Gemini 2.5 Flash
    console.log("OpenAI Fallback -> Przełączam na model: gemini-2.5-flash");
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
            return res.status(200).json({ text: geminiRes.text, modelUsed: "gemini-2.5-flash" });
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
}
