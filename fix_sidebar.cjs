const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

// Remove the clearing logic from onClick in Sidebar
code = code.replace(
  `            onClick={() => {
              if (user?.hasNewVocabulary && user?.id) {
                 import('firebase/firestore').then(({ doc, updateDoc }) => {
                   updateDoc(doc(db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error);
                 });
              }
              handleNavigate('flashcard-sets');
            }} `,
  `            onClick={() => handleNavigate('flashcard-sets')} `
);

code = code.replace(
  `            onClick={() => {
              if (user?.hasNewLesson && user?.id) {
                 import('firebase/firestore').then(({ doc, updateDoc }) => {
                   updateDoc(doc(db, 'users', user.id), { hasNewLesson: false }).catch(console.error);
                 });
              }
              handleNavigate('lesson-history');
            }} `,
  `            onClick={() => handleNavigate('lesson-history')} `
);

fs.writeFileSync('components/dashboard/Sidebar.tsx', code);
