import fs from 'fs';
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const target = `  const handleFinishAll = async () => {
    // Generate full results
    const results = exercises.map((_, i) => singleEvaluationResults[i]).filter(Boolean);
    setEvaluationResults(results);
    setStep('results');
    setTimeLeft(null);`;

const replacement = `  const handleFinishAll = async () => {
    setIsGeneratingMore(true);
    let currentEvalResults = { ...singleEvaluationResults };
    
    // Find sentences that need evaluation
    const unevaluatedIndices = [];
    for (let i = 0; i < exercises.length; i++) {
      if (studentAnswers[i]?.trim() && !currentEvalResults[i]) {
        unevaluatedIndices.push(i);
      }
    }

    if (unevaluatedIndices.length > 0) {
      try {
        const evalStudentContext = \`\${user?.firstName ? \`Zwracaj się do ucznia po imieniu (\${user.firstName}), odmieniając je naturalnie we wszystkich przypadkach w języku polskim zgodnie z regułami języka polskiego.\` : ''}\`;
        let weaknessesListStr = "Brak zidentyfikowanych błędów";
        if (user) {
          weaknessesListStr = await getUserWeaknesses(user.id);
        }
        let strictnessPrompt = customEvalPrompt.replace(/\\$\\{weaknessesList(?: \\|\\| "[^"]+")?\\}/g, weaknessesListStr);
        if (evaluationStrictness === 'strict') {
          strictnessPrompt += '\\n\\nOCENIAJ BARDZO RYGORYSTYCZNIE. Każdy drobny błąd w pisowni, czasie lub przedimku (a/an/the) oznacza isCorrect: false.';
        } else if (evaluationStrictness === 'loose') {
          strictnessPrompt += '\\n\\nOCENIAJ LUŹNO. Akceptuj drobne błędy i literówki. Zwracaj uwagę na ogólny przekaz.';
        }

        const exercisesToEval = unevaluatedIndices.map(i => exercises[i]);
        const answersToEval = unevaluatedIndices.map(i => studentAnswers[i]);
        const batchResults = await evaluateTranslations(exercisesToEval, answersToEval, strictnessPrompt, evalStudentContext);

        if (batchResults && batchResults.length === unevaluatedIndices.length) {
          batchResults.forEach((res, idx) => {
            currentEvalResults[unevaluatedIndices[idx]] = res;
          });
          setSingleEvaluationResults(currentEvalResults);
          
          let newStatuses = {};
          unevaluatedIndices.forEach(idx => {
            newStatuses[idx] = 'evaluated';
          });
          setEvaluationStatuses(prev => ({ ...prev, ...newStatuses }));
        }
      } catch (err) {
        console.error("Batch evaluation failed", err);
        setError(language === 'pl' ? "Błąd podczas masowej oceny: " + err.message : "Error during batch evaluation: " + err.message);
        setIsGeneratingMore(false);
        return;
      }
    }

    setIsGeneratingMore(false);

    // Generate full results
    const results = exercises.map((_, i) => currentEvalResults[i]).filter(Boolean);
    setEvaluationResults(results);
    setStep('results');
    setTimeLeft(null);`;

content = content.replace(target, replacement);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
console.log("Patched finish all");
