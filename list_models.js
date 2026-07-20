import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "dummy" });

async function run() {
  try {
    const response = await ai.models.list();
    console.log(response);
  } catch (e) {
    console.error(e);
  }
}
run();
