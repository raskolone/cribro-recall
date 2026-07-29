const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const importRegex = /import \{ doc, getDoc \} from 'firebase\/firestore';/;
if (!importRegex.test(code)) {
    code = code.replace(/import \{ db \} from '\.\.\/\.\.\/firebase';/, "import { db } from '../../firebase';\nimport { doc, getDoc } from 'firebase/firestore';");
}

const useEffectHook = `
  useEffect(() => {
    const fetchTopics = async () => {
      setIsLoadingTopics(true);
      try {
        const docRef = doc(db, 'system', 'topic_database');
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().chapters) {
          setGrammarChapters(snap.data().chapters);
        }
      } catch (err) {
        console.error("Error fetching grammar topics", err);
      } finally {
        setIsLoadingTopics(false);
      }
    };
    fetchTopics();
  }, []);
`;

// Find a good place to insert it
code = code.replace(/  useEffect\(\(\) => \{\n    if \(step === 'setup'\) \{/, useEffectHook + "\n  useEffect(() => {\n    if (step === 'setup') {");

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
