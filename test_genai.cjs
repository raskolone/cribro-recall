const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: "AIzaSyB..." });
const req = {
  model: 'gemini-2.5-flash',
  contents: [
    {
      inlineData: {
        data: "abc",
        mimeType: 'application/pdf'
      }
    },
    { text: "What is this?" }
  ]
};
try {
  console.log("Req is valid?", req);
} catch(e) {}
