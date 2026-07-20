import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "dummy" });

async function test() {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  for (const model of models) {
    try {
      console.log(`Trying ${model}...`);
      await ai.models.generateContent({ model, contents: "hi" });
      console.log(`Success ${model}`);
    } catch(e) {
      console.log(`Error ${model}:`, e.status, e.message);
    }
  }
}
test();
