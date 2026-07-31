const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

code = code.replace(
  "CRITICAL RULE: The field `polish_translation` MUST NEVER be in English. It MUST be the Polish translation. Do NOT output English in the polish_translation field.",
  "CRITICAL RULE: The field \\`polish_translation\\` MUST NEVER be in English. It MUST be the Polish translation. Do NOT output English in the polish_translation field."
);

code = code.replace(
  "PAMIĘTAJ: Pole `polish_translation` (lub `polishSentence`) MUSI być ZAWSZE po polsku. Pole `english_sentence` (lub `englishTranslation`) MUSI być ZAWSZE po angielsku. Upewnij się, że nie pozamieniałeś języków miejscami!",
  "PAMIĘTAJ: Pole \\`polish_translation\\` (lub \\`polishSentence\\`) MUSI być ZAWSZE po polsku. Pole \\`english_sentence\\` (lub \\`englishTranslation\\`) MUSI być ZAWSZE po angielsku. Upewnij się, że nie pozamieniałeś języków miejscami!"
);

fs.writeFileSync('services/geminiService.ts', code);
