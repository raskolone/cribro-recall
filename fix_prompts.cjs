const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

// Fix generateTranslationExercises prompt
code = code.replace(
  "OUTPUT FORMAT (Strict JSON):",
  "CRITICAL RULE: The field `polish_translation` MUST NEVER be in English. It MUST be the Polish translation. Do NOT output English in the polish_translation field.\n\nOUTPUT FORMAT (Strict JSON):"
);

// Fix verificationPrompt
code = code.replace(
  "Zwróć skorygowany wynik WYŁĄCZNIE jako poprawny obiekt JSON, zachowując dokładnie tę samą strukturę (klucze).",
  "PAMIĘTAJ: Pole `polish_translation` (lub `polishSentence`) MUSI być ZAWSZE po polsku. Pole `english_sentence` (lub `englishTranslation`) MUSI być ZAWSZE po angielsku. Upewnij się, że nie pozamieniałeś języków miejscami!\n\nZwróć skorygowany wynik WYŁĄCZNIE jako poprawny obiekt JSON, zachowując dokładnie tę samą strukturę (klucze)."
);

fs.writeFileSync('services/geminiService.ts', code);
