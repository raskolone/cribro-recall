import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.list();
    console.log("Response keys:", Object.keys(response));
    if (response.models) {
        console.log(response.models.map(m => m.name).join(', '));
    } else {
        console.log(response);
    }
  } catch (e) {
    console.error(e.message || e);
  }
}
run();
