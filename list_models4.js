import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.list();
    if (response) {
       for await (const m of response) {
          console.log(m.name);
       }
    }
  } catch (e) {
    console.error(e.message || e);
  }
}
run();
