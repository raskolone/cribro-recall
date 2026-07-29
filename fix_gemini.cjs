const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const regex = /SPECIAL INSTRUCTION FOR PUZZLE CHUNKS: When generating puzzleChunks, DO NOT split the sentence into single words, especially at higher levels! Create logical, natural phrasing blocks \(e\.g\., keep phrasal verbs together, keep names with titles, don't separate prepositions from their noun phrases if it breaks logic\)\. Act as a highly intelligent assistant structuring a warmup exercise\./;

const replacement = "SPECIAL INSTRUCTION FOR PUZZLE CHUNKS: The goal of this exercise is just to familiarize the user with the material, so split the sentence into LONGER chunks (2-4 words per chunk). Do NOT split into single words. Keep logical phrases together (e.g., 'I have been', 'to the store').";

code = code.replace(regex, replacement);
fs.writeFileSync('services/geminiService.ts', code);
