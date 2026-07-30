const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = "selectedSetId === 'grammar' && selectedGrammarTopics ? (language === 'pl' ? `Gramatyka ${selectedGrammarTopics.chapterIndex + 1} - ${selectedGrammarTopics.name}` : `Grammar ${selectedGrammarTopics.chapterIndex + 1} - ${selectedGrammarTopics.name}`) :";
const replacement = "selectedSetId === 'grammar' && selectedGrammarTopics && selectedGrammarTopics.length > 0 ? (language === 'pl' ? `Gramatyka: ${selectedGrammarTopics.map(t => t.name).join(', ')}` : `Grammar: ${selectedGrammarTopics.map(t => t.name).join(', ')}`) :";

content = content.replace(target, replacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Done");
