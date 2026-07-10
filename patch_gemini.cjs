const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

const target = `  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: finalPrompt,
      config: {
        systemInstruction: "Jesteś inteligentnym asystentem edukacyjnym ZEIAN. Twoim najważniejszym celem jest: 1. Bezwzględne dopasowanie poziomu (jeśli A1, A2 lub A2/B1 to zdania proste, krótkie; jeśli poziomy pośrednie jak B1/B2 to trudność zbilansowana). 2. Precyzyjne zrozumienie kontekstu ucznia (np. jeśli produkuje części do samolotów, nie twórz zdań, w których lata samolotami, nie twórz sztucznych kontekstów). 3. Nieustanne weryfikowanie historii lekcji i poprzednich zdań jako bazy referencyjnej trudności. Używaj historii, by nie tworzyć zdań bardziej skomplikowanych niż te już przerobione oraz do unikania powtórek w najnowszych 3 sesjach.",
        responseMimeType: "application/json",
        responseSchema: translationExerciseSchema,
      },
    });`;

const replacement = `  try {
    let response;
    const config = {
      systemInstruction: "Jesteś inteligentnym asystentem edukacyjnym ZEIAN. Twoim najważniejszym celem jest: 1. Bezwzględne dopasowanie poziomu (jeśli A1, A2 lub A2/B1 to zdania proste, krótkie; jeśli poziomy pośrednie jak B1/B2 to trudność zbilansowana). 2. Precyzyjne zrozumienie kontekstu ucznia (np. jeśli produkuje części do samolotów, nie twórz zdań, w których lata samolotami, nie twórz sztucznych kontekstów). 3. Nieustanne weryfikowanie historii lekcji i poprzednich zdań jako bazy referencyjnej trudności. Używaj historii, by nie tworzyć zdań bardziej skomplikowanych niż te już przerobione oraz do unikania powtórek w najnowszych 3 sesjach.",
      responseMimeType: "application/json",
      responseSchema: translationExerciseSchema,
    };
    
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    } catch (e1: any) {
      console.warn("gemini-3.5-flash failed, falling back to gemini-3.1-flash-lite", e1);
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: finalPrompt,
          config,
        });
      } catch (e2: any) {
        console.warn("gemini-3.1-flash-lite failed, falling back to gemini-3.1-flash-lite-preview", e2);
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: finalPrompt,
          config,
        });
      }
    }`;

if (code.includes('model: "gemini-3.5-flash"')) {
  code = code.replace(target, replacement);
  fs.writeFileSync('services/geminiService.ts', code);
  console.log("Replaced");
} else {
  console.log("Not found");
}
