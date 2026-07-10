const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const response = await ai.models.list();
    console.log(response);
    for await (const model of response) {
      console.log(model.name);
    }
  } catch(e) {
    console.error(e.message);
  }
}
test();
