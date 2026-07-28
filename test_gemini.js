import { GoogleGenAI } from "@google/genai";
async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    });
    console.log("2.5 SUCCESS");
  } catch (err) {
    console.log("2.5 ERROR:");
    console.log(err.message);
  }
}
test();
