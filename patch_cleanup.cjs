const fs = require('fs');

let content = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf8');

content = content.replace(
  `        return data.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));`,
  `        return data.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());`
);

fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', content);
