const fs = require('fs');
let code = fs.readFileSync('components/ui/AdminMessageModal.tsx', 'utf8');

const targetImport = `import { doc, updateDoc } from 'firebase/firestore';`;
const newImport = `import { doc, updateDoc, deleteField } from 'firebase/firestore';`;
code = code.replace(targetImport, newImport);

const targetUpdate = `await updateDoc(userRef, { adminMessage: null });`;
const newUpdate = `await updateDoc(userRef, { adminMessage: deleteField() });`;
code = code.replace(targetUpdate, newUpdate);

fs.writeFileSync('components/ui/AdminMessageModal.tsx', code);
