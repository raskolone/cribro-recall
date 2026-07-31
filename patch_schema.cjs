const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const targetSchema = `const sentenceGeneratorSchema = {
  type: Type.OBJECT,
  properties: {
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          english_sentence: { type: Type.STRING, description: "Clean, natural English sentence." },
          polish_translation: { type: Type.STRING, description: "Naturalne polskie tłumaczenie." }
        },
        required: ["id", "english_sentence", "polish_translation"]
      }
    }
  },
  required: ["sentences"]
};`;

// Wait, let's just grep the exact schema to be sure
