const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf-8');

// Firebase require will fail in frontend! I need to use the already imported getDocs, collection.
const target = `      const { collection, getDocs } = require('firebase/firestore');
      const vocabSetsSnap = await getDocs(collection(db, 'vocabularySets'));`;

const replacement = `      const { getDocs, collection } = await import('firebase/firestore');`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
    console.log("Patched TopicDatabaseScreen.tsx (fixed firebase require)");
} else {
    console.log("Target not found");
}
