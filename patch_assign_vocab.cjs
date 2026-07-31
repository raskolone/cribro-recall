const fs = require('fs');
let code = fs.readFileSync('components/admin/AssignVocabularyModal.tsx', 'utf8');

const target = "await batch.commit();";
const replacement = `      // Set hasNewVocabulary flag for the target student
      batch.update(doc(db, \`users/\${targetUser.id}\`), { hasNewVocabulary: true });
      await batch.commit();`;
      
if (code.includes(target) && !code.includes("hasNewVocabulary: true")) {
  code = code.replace(target, replacement);
  fs.writeFileSync('components/admin/AssignVocabularyModal.tsx', code);
}
