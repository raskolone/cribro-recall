const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardSetsScreen.tsx', 'utf8');

const target = "const handlePreviewSet = async (setId: string) => {";
const replacement = `const handlePreviewSet = async (setId: string) => {
    try {
      const local = JSON.parse(localStorage.getItem('checked_sets') || '[]');
      if (!local.includes(setId)) {
        localStorage.setItem('checked_sets', JSON.stringify([...local, setId]));
      }
    } catch(e) {}
    
    if (user?.hasNewVocabulary && user?.id) {
       import('firebase/firestore').then(({ doc, updateDoc }) => {
         updateDoc(doc(import('../../firebase').then(m=>m.db), 'users', user.id), { hasNewVocabulary: false }).catch(console.error);
       });
    }
`;

if (code.includes(target) && !code.includes("localStorage.setItem('checked_sets'")) {
  code = code.replace(target, replacement);
  fs.writeFileSync('components/flashcards/FlashcardSetsScreen.tsx', code);
}
