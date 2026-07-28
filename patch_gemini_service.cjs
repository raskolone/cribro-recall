const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

// 1. Update sentenceGeneratorSchema
code = code.replace(
  /hint: \{ type: Type.STRING, description: "A subtle hint in Polish, e.g. suggesting a grammar structure or vocabulary clue." \}/,
  `hint: { type: Type.STRING, description: "A subtle hint in Polish, e.g. suggesting a grammar structure or vocabulary clue." },\n          puzzleChunks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of sentence chunks for the warmup exercise. Keep phrases logical (e.g. phrasal verbs together, don't split very short words)." }`
);

// 2. Update masterPrompt
code = code.replace(
  /"hint": "Wskazówka po polsku"/,
  `"hint": "Wskazówka po polsku",\n      "puzzleChunks": ["Clean,", "natural English", "sentence."]`
);

// 3. Update systemInstruction
code = code.replace(
  /systemInstruction: "You are an expert English Language Content Creator specializing in adaptive, personalized language practice. Always prioritize natural logic, practical communication, and strict JSON output."/,
  `systemInstruction: "You are an expert English Language Content Creator specializing in adaptive, personalized language practice. Always prioritize natural logic, practical communication, and strict JSON output. SPECIAL INSTRUCTION FOR PUZZLE CHUNKS: When generating puzzleChunks, DO NOT split the sentence into single words, especially at higher levels! Create logical, natural phrasing blocks (e.g., keep phrasal verbs together, keep names with titles, don't separate prepositions from their noun phrases if it breaks logic). Act as a highly intelligent assistant structuring a warmup exercise."`
);

// 4. Update the map
code = code.replace(
  /return \{\n          polishSentence,\n          englishTranslation,\n          hint,\n        \};/,
  `return {\n          polishSentence,\n          englishTranslation,\n          hint,\n          puzzleChunks: item.puzzleChunks || undefined,\n        };`
);

fs.writeFileSync('services/geminiService.ts', code);
console.log("Patched successfully");
