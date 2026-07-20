import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: "dummy" });

async function test() {
  const params = { model: "gemini-1.5-flash", contents: "test" };
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000));
  try {
    await Promise.race([ai.models.generateContent(params), timeoutPromise]);
    console.log("Success");
  } catch(e) {
    console.log("Caught:", e.message);
  }
}
test();
