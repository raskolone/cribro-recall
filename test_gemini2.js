import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hello world",
    });
    console.log("SUCCESS:", response.text);
  } catch(e) {
    console.error("FAIL 1:", e.status);
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: "Hello world",
      });
      console.log("SUCCESS 2:", response.text);
    } catch(e2) {
      console.error("FAIL 2:", e2.status);
    }
  }
}
run();
