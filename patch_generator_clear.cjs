const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

const importRegex = /import \{ useAuth \} from '\.\.\/\.\.\/context\/AuthContext';/;
if (content.match(importRegex) && !content.includes("import { doc, updateDoc } from 'firebase/firestore';")) {
  content = content.replace("import { collection, getDocs, query, orderBy, limit, addDoc, where, documentId } from 'firebase/firestore';", "import { collection, getDocs, query, orderBy, limit, addDoc, where, documentId, doc, updateDoc } from 'firebase/firestore';");
}

const effectStart = `  useEffect(() => {
    if (user?.id) {
      getVocabularySetsForStudent(user.id)`;

const effectNew = `  useEffect(() => {
    if (user?.id) {
      // Clear new vocabulary flag
      if (user.hasNewVocabulary) {
         updateDoc(doc(db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error);
      }
      
      getVocabularySetsForStudent(user.id)`;

content = content.replace(effectStart, effectNew);
fs.writeFileSync(path, content);
console.log("Patched 4");
