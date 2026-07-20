const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
`  const [vocabularySets, setVocabularySets] = useState<VocabularySet[]>([]);

  useEffect(() => {
    if (user?.id) {
      getVocabularySetsForStudent(user.id)
        .then(setVocabularySets)
        .catch(console.error);
    }
  }, [user?.id]);`,
`  const [vocabularySets, setVocabularySets] = useState<any[]>([]); // renamed to any for broader type, will store lesson records

  useEffect(() => {
    if (user?.id) {
      const fetchLessons = async () => {
        try {
          const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
          const { db } = await import('../../firebase');
          const q = query(collection(db, \`users/\${user.id}/lessonRecords\`), orderBy('date', 'desc'));
          const snapshot = await getDocs(q);
          const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setVocabularySets(records);
        } catch (error) {
          console.error(error);
        }
      };
      fetchLessons();
    }
  }, [user?.id]);`
);

fs.writeFileSync(path, content);
console.log('Fixed generator lessons list');
