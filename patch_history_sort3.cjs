const fs = require('fs');

let content = fs.readFileSync('components/dashboard/LessonHistory.tsx', 'utf8');

const target = `        const q = query(
          collection(db, \`users/\${user.id}/lessonRecords\`),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetchedLessons = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LessonRecord));
        setLessons(fetchedLessons);`;

const replacement = `        const q = query(
          collection(db, \`users/\${user.id}/lessonRecords\`)
        );
        const snapshot = await getDocs(q);
        const fetchedLessons = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LessonRecord));
        fetchedLessons.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        setLessons(fetchedLessons);`;

content = content.replace(target, replacement);

fs.writeFileSync('components/dashboard/LessonHistory.tsx', content);
