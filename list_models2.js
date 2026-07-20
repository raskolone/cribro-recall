import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.list();
    for (const model of response) {
      console.log(model.name);
    }
  } catch (e) {
    console.error(e.message || e);
  }
}
run();
