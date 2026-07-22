const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const bypassLogic = `
  const handleGenerate = async (isAppending = false) => {
    if (selectedSetId?.startsWith('special-task-')) {
      const taskId = selectedSetId.replace('special-task-', '');
      const task = specialTasks.find(t => t.id === taskId);
      if (task) {
        if (isAppending) {
           setIsGeneratingMore(false);
           return; // special tasks have fixed number of sentences, don't generate more
        }
        setIsLoading(true);
        setError('');
        try {
           setExercises(task.sentences);
           setStudentAnswers(new Array(task.sentences.length).fill(''));
           setShowHints(new Array(task.sentences.length).fill(false));
           setStep('practice');
        } catch(e) {
           setError('Błąd ładowania zadania specjalnego');
        } finally {
           setIsLoading(false);
        }
        return;
      }
    }
`;
code = code.replace(
  /const handleGenerate = async \(isAppending = false\) => \{/g,
  bypassLogic.trim()
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('patched handleGenerate');
