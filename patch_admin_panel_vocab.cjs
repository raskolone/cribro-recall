const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const target1 = `      // Fetch User's Flashcard Sets
      try {
        const setsQ = query(collection(db, 'sets'), where('userId', '==', userId));
        const setsSnapshot = await getDocs(setsQ);`;

const replacement1 = `      // Fetch User's Flashcard Sets (now we fetch wordSets inside user doc)
      try {
        const setsQ = query(collection(db, \`users/\${userId}/wordSets\`));
        const setsSnapshot = await getDocs(setsQ);`;

const target2 = `                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">{set.title}</h4>
                        {set.assignedByTeacher && (`;

const replacement2 = `                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">{set.title || set.name}</h4>
                        {set.assignedByTeacher && (`;

if (code.includes(target1) && code.includes(target2)) {
    code = code.replace(target1, replacement1);
    code = code.replace(target2, replacement2);
    fs.writeFileSync('components/admin/AdminPanel.tsx', code);
    console.log("Patched AdminPanel.tsx (fetch user sets)");
} else {
    console.log("Target not found");
}
