const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetCall = `      const generated = await generateTranslationExercises(
        level, 
        wordsToUse, 
        resolvedGenPrompt, 
        lessonContextString, 
        studentProfileContext, 
        practiceMode === 'time' ? 10 : numSentences, 
        pastExercisesContext, 
        selectedSetId === 'grammar',
        (model) => setActiveGeneratingModel(model)
      );`;

const newCall = `      const generated = await generateTranslationExercises(
        level, 
        wordsToUse, 
        resolvedGenPrompt, 
        lessonContextString, 
        studentProfileContext, 
        practiceMode === 'time' ? 10 : numSentences, 
        pastExercisesContext, 
        weaknessesList,
        selectedSetId === 'grammar',
        (model) => setActiveGeneratingModel(model)
      );`;

code = code.replace(targetCall, newCall);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
