import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, systemInstruction, isJson, messages } = req.body || {};
    if (!prompt && !messages) {
      return res.status(400).json({ error: 'Missing prompt or messages' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    let chatMessages = messages;
    if (!chatMessages) {
      chatMessages = [
        ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
        { role: "user", content: prompt || "" }
      ];
    }

    const openAiModels = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo", "gpt-4-turbo"];
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
          const timeoutId = setTimeout(() => controller.abort(), 10000);

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
