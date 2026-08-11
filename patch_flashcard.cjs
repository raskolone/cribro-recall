const fs = require('fs');
let content = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

content = content.replace(
  /onNavigate\('ai-generator', \{ setId: setId, initialMode: 'flashcards' \}\)/g,
  `onNavigate('ai-generator', { setId: setId, initialMode: 'flashcards', autoGenerate: true })`
);

fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', content);
