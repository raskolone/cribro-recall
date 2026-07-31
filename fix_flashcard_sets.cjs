const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardSetsScreen.tsx', 'utf8');

code = code.replace(
  "updateDoc(doc(import('../../firebase').then(m=>m.db), 'users', user.id), { hasNewVocabulary: false }).catch(console.error);",
  "import('../../firebase').then(m => updateDoc(doc(m.db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error));"
);

fs.writeFileSync('components/flashcards/FlashcardSetsScreen.tsx', code);
