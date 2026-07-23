const fs = require('fs');

let content = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf8');

const target1 = `const q = query(collection(db, \`users/\${user.id}/lessonRecords\`), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);`;

const replacement1 = `const q = query(collection(db, \`users/\${user.id}/lessonRecords\`));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));
        return data.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());`;

content = content.replace(target1, replacement1);
// Wait, the original code had:
// const snapshot = await getDocs(q);
// return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));
// So I should replace everything up to the map.

fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', content);
