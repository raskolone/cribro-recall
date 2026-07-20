const fs = require('fs');
const path = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldAssign = `      // Copy flashcards
      const cardsRef = collection(db, \`sets/\${setToAssign.id}/flashcards\`);
      const cardsSnapshot = await getDocs(cardsRef);
      
      cardsSnapshot.forEach(cardDoc => {
        const cardData = cardDoc.data();
        const newCardRef = doc(collection(db, \`sets/\${newSetId}/flashcards\`));
        batch.set(newCardRef, cardData);
      });

      await batch.commit();
      
      alert('Zestaw przypisany pomyślnie!');
      setSelectedSetIdToAssign('');`;

const newAssign = `      // Copy flashcards
      const cardsRef = collection(db, \`sets/\${setToAssign.id}/flashcards\`);
      const cardsSnapshot = await getDocs(cardsRef);
      
      cardsSnapshot.forEach(cardDoc => {
        const cardData = cardDoc.data();
        const newCardRef = doc(collection(db, \`sets/\${newSetId}/flashcards\`));
        batch.set(newCardRef, cardData);
      });

      await batch.commit();
      
      // Update user with hasNewVocabulary flag
      await updateDoc(doc(db, 'users', selectedUser.id), {
         hasNewVocabulary: true
      });
      
      alert('Zestaw przypisany pomyślnie!');
      setSelectedSetIdToAssign('');`;

content = content.replace(oldAssign, newAssign);
fs.writeFileSync(path, content);
console.log("Patched 3");
