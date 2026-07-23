const fs = require('fs');

let content = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf8');

const target1 = `      const fetchLessons = async () => {
        const q = query(collection(db, \`users/\${user.id}/lessonRecords\`), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));
      };`;

const replacement1 = `      const fetchLessons = async () => {
        const q = query(collection(db, \`users/\${user.id}/lessonRecords\`));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonRecord));
        return data.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      };`;

content = content.replace(target1, replacement1);

const target2 = `      const fetchPracticeLogs = async () => {
        const q = query(collection(db, \`users/\${user.id}/practiceLogs\`), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeLog));
      };`;

const replacement2 = `      const fetchPracticeLogs = async () => {
        const q = query(collection(db, \`users/\${user.id}/practiceLogs\`));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeLog));
        return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      };`;

content = content.replace(target2, replacement2);

fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', content);
