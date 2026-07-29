const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// Ensure doc, getDoc imports
if (!code.includes("doc, getDoc") && !code.includes("getDoc, doc")) {
    code = code.replace(/import \{ collection, getDocs/, "import { doc, getDoc, collection, getDocs");
}

const useEffectToAdd = `
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

code = code.replace(/  useEffect\(\(\) => \{\s*if \(user\?\.id\) \{/, useEffectToAdd + "\n  useEffect(() => {\n    if (user?.id) {");
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
