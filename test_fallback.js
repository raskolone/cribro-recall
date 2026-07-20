import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: "dummy" });
const models = ["gemini-3.5-flash", "gemini-1.5-flash"];
async function test() {
  for (const model of models) {
    try {
      console.log("Trying", model);
      await ai.models.generateContent({ model, contents: "hi" });
    } catch(e) {
      console.log("Error:", e.status, e.message);
    }
  }
}
test();
