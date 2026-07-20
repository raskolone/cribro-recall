import { GoogleGenAI, Type } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const translationExerciseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      polishSentence: { type: Type.STRING, description: "Zdanie po polsku do przetłumaczenia" },
      englishTranslation: { type: Type.STRING, description: "The correct or recommended English translation" },
      hint: { type: Type.STRING, description: "A subtle hint in Polish, e.g., suggesting a grammar structure or key vocabulary word to use" }
    },
    required: ['polishSentence', 'englishTranslation', 'hint']
  }
};

async function run() {
  try {
    const config = {
        systemInstruction: "You are an AI language tutor.",
        responseMimeType: "application/json",
        responseSchema: translationExerciseSchema,
    };
    const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: "Generate 2 sentences",
        config
    });
    console.log("Success!");
    console.log(response.text);
  } catch (e) {
    console.error("Status:", e.status);
    console.error("Message:", e.message);
  }
}
run();
