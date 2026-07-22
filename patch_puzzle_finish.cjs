const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// 1. In handleFinishAll
const target1 = `    setIsGeneratingMore(true);
    let currentEvalResults = { ...singleEvaluationResults };`;
const replacement1 = `    if (exerciseFormat === 'puzzle') {
      setExerciseFormat('typing');
      setStep('setup');
      setExercises([]);
      setStudentAnswers([]);
      setTimeLeft(null);
      return;
    }

    setIsGeneratingMore(true);
    let currentEvalResults = { ...singleEvaluationResults };`;

// 2. Change button labels
const target2 = `{language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize'}`;
const replacement2 = `{exerciseFormat === 'puzzle' ? (language === 'pl' ? 'Zakończ rozgrzewkę' : 'Finish warmup') : (language === 'pl' ? 'Zakończ i podsumuj' : 'Finish & Summarize')}`;

if (code.includes(target1)) {
  code = code.replace(target1, replacement1);
  console.log('handleFinishAll patched');
}

// target2 will match multiple times, let's replace all occurrences in the buttons
// But wait, it's used 4 times in the file.
code = code.split(target2).join(replacement2);
console.log('Button labels patched');

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
