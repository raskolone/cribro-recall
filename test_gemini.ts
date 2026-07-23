import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: "Hello",
    });
    console.log("Success:", res.text);
  } catch (e: any) {
    console.error("Error:", e.message, e.status);
  }
}
run();
