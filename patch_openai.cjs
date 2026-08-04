const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

const replacement = `
import OpenAI from "openai";

const callOpenAI = async (prompt: string, systemInstruction: string, model: string = "gpt-4o-mini") => {
  const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Brak VITE_OPENAI_API_KEY w środowisku!");
    throw new Error("Missing VITE_OPENAI_API_KEY");
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });

  console.log("Wysyłam zapytanie do OpenAI (gpt-4o-mini)...");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // always hardcoded to gpt-4o-mini
      messages: [
        { role: "system", content: systemInstruction || "You are a helpful assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    console.log("Odpowiedź OpenAI odebrana pomyślnie.");
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Błąd wywołania OpenAI:", error);
    throw error;
  }
};
`;

code = code.replace(/const callOpenAI = async \([\s\S]*?\n};\n/, replacement.trim() + "\n");
fs.writeFileSync('services/geminiService.ts', code);
console.log("Patched callOpenAI in services/geminiService.ts");
