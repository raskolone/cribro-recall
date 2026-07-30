const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf-8');

// I need to add vocabulary state and rendering
const target1 = `  const [chapters, setChapters] = useState<GrammarChapter[]>(DEFAULT_CHAPTERS);`;
const replacement1 = `  const [chapters, setChapters] = useState<GrammarChapter[]>(DEFAULT_CHAPTERS);
  const [vocabularySets, setVocabularySets] = useState<any[]>([]);
  const [expandedVocabSetId, setExpandedVocabSetId] = useState<string | null>(null);`;

const target2 = `  const fetchData = async () => {
    try {
      const docRef = doc(db, 'system', 'topic_database');
      const snap = await getDoc(docRef);`;

const replacement2 = `  const fetchData = async () => {
    try {
      // Fetch vocabulary sets from all users
      const { collection, getDocs } = require('firebase/firestore');
      const vocabSetsSnap = await getDocs(collection(db, 'vocabularySets'));
      // Wait, vocabulary sets are per-user in this structure?
      // Let's check how vocabularySets are stored. Yes, users/{userId}/vocabularySets or vocabularySets globally?
      // No, in previous search: collection(db, "vocabulary") and collection(db, \`users/\${userId}/vocabularySets\`).
      // Wait, there is a global collection 'vocabulary' with all words.
      const vocabSnap = await getDocs(collection(db, 'vocabulary'));
      
      const allWords = vocabSnap.docs.map(d => ({id: d.id, ...d.data()}));
      
      // Group by studentId and lessonNumber?
      const grouped = {};
      allWords.forEach(w => {
         const key = \`Student: \${w.studentId} | Lekcja: \${w.lessonNumber || '?'}\`;
         if(!grouped[key]) grouped[key] = { id: key, name: key, words: [] };
         grouped[key].words.push(w);
      });
      setVocabularySets(Object.values(grouped));

      const docRef = doc(db, 'system', 'topic_database');
      const snap = await getDoc(docRef);`;

if (code.includes(target1) && code.includes(target2)) {
    code = code.replace(target1, replacement1);
    code = code.replace(target2, replacement2);
    fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
    console.log("Patched TopicDatabaseScreen.tsx (Vocabulary added to state)");
} else {
    console.log("Target not found");
}
