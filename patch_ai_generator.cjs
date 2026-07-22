const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// 1. Add state for specialTasks
code = code.replace(
  /const \[vocabularySets, setVocabularySets\] = useState<VocabularySet\[\]>\(\[\]\);/g,
  'const [vocabularySets, setVocabularySets] = useState<VocabularySet[]>([]);\n  const [specialTasks, setSpecialTasks] = useState<any[]>([]);'
);

// 2. Add fetch logic inside the useEffect where we fetch vocabularySets
const fetchTasksCode = `
    if (user?.id) {
      getVocabularySetsForStudent(user.id)
        .then(setVocabularySets)
        .catch(console.error);

      // fetch special tasks
      import('firebase/firestore').then(({ collection, getDocs, query, where, orderBy }) => {
        const tasksQ = query(collection(db, 'specialTasks'), where('studentId', '==', user.id));
        getDocs(tasksQ).then(snap => {
          const tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          tasks.sort((a, b) => new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime() - new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime());
          setSpecialTasks(tasks.filter(t => t.status === 'pending')); // only pending tasks
        });
      });
    }
`;
code = code.replace(
  /if \(user\?\.id\) \{\n\s*getVocabularySetsForStudent\(user\.id\)\n\s*\.then\(setVocabularySets\)\n\s*\.catch\(console\.error\);\n\s*\}/g,
  fetchTasksCode
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('patched');
