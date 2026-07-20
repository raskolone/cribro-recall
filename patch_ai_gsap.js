import fs from 'fs';

let file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(
  "if (step === 'results' && evaluationResults.length > 0 && resultsRef.current) {",
  "if (step === 'results' && evaluationResults.length > 0 && resultsRef.current && resultsRef.current.children.length > 0) {"
);
fs.writeFileSync(file, content);
console.log("Patched AI exercise gsap");
