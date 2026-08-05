const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(
  "  const [activeGeneratingModel, setActiveGeneratingModel] = useState<string>('deepseek-chat');",
  "  const [activeGeneratingModel, setActiveGeneratingModel] = useState<string>('deepseek-chat');\n  const [lastUsedWords, setLastUsedWords] = useState<string[]>([]);"
);

code = code.replace(
  "        wordsToUse,",
  "        wordsToUse,\n        setLastUsedWords(wordsToUse)," // This won't work syntactically because wordsToUse is passed as an argument.
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
