const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const targetSchema = `          target_word_used: { type: Type.STRING, description: "The single target word used in this sentence." },
          hint: { type: Type.STRING, description: "A subtle hint in Polish, e.g. suggesting a grammar structure or vocabulary clue." },
          puzzleChunks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of sentence chunks for the warmup exercise. Keep phrases logical (e.g. phrasal verbs together, don't split very short words)." }
        },
        required: ['english_sentence', 'polish_translation', 'puzzleChunks']`;

const newSchema = `          target_word_used: { type: Type.STRING, description: "The single target word used in this sentence." },
          hint: { type: Type.STRING, description: "Krótka podpowiedź po polsku. MUSI zawierać kluczowe/trudne słówka z tego zdania w języku angielskim oraz wskazówkę gramatyczną (np. jakiego czasu użyć)." },
          puzzleChunks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of sentence chunks for the warmup exercise. Keep phrases logical (e.g. phrasal verbs together, don't split very short words)." }
        },
        required: ['english_sentence', 'polish_translation', 'hint', 'puzzleChunks']`;

code = code.replace(targetSchema, newSchema);

const targetPromptRule = `- LOGIC & REALISM: Sentences MUST be practical, logical, and make total sense in real-world communication. Do NOT forcefully weave random student profile keywords or hobbies into a sentence if it makes the sentence illogical, weird, or artificial. Practical usability is the absolute highest priority.`;

const newPromptRule = `- LOGIC & REALISM: Sentences MUST be practical, logical, and make total sense in real-world communication. Do NOT forcefully weave random student profile keywords or hobbies into a sentence if it makes the sentence illogical, weird, or artificial. Practical usability is the absolute highest priority.
- HINT REQUIREMENT: Pole \`hint\` musi ZAWSZE zawierać kluczowe trudne słowa z danego zdania (angielskie) wraz z tłumaczeniem, plus krótką wskazówkę co do użytej struktury gramatycznej.`;

code = code.replace(targetPromptRule, newPromptRule);

const verificationPromptTarget = `PAMIĘTAJ: Pole \`polish_translation\` (lub \`polishSentence\`) MUSI być ZAWSZE po polsku. Pole \`english_sentence\` (lub \`englishTranslation\`) MUSI być ZAWSZE po angielsku. Upewnij się, że nie pozamieniałeś języków miejscami!`;

const verificationPromptNew = `PAMIĘTAJ: Pole \`polish_translation\` (lub \`polishSentence\`) MUSI być ZAWSZE po polsku. Pole \`english_sentence\` (lub \`englishTranslation\`) MUSI być ZAWSZE po angielsku. Upewnij się, że nie pozamieniałeś języków miejscami!
Pole \`hint\` również MUSI znajdować się w wyniku i zawierać trudne słówka + gramatykę.`;

code = code.replace(verificationPromptTarget, verificationPromptNew);

fs.writeFileSync('services/geminiService.ts', code);
