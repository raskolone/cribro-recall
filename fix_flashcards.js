const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');
code = code.replace(/if\(currentCard.audioUrl\)\{const audio = new Audio\(currentCard.audioUrl\);audio.play\(\);\}\s+audio\.play\(\);/g, 'if(currentCard.audioUrl){const audio = new Audio(currentCard.audioUrl);audio.play();}');
fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', code);
