const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const target = `      addLog('Calling generateTranslationExercises');
      const generated = await generateTranslationExercises(
        level, 
        wordsToUse,
        setLastUsedWords(wordsToUse), 
        resolvedGenPrompt,`;

const replacement = `      addLog('Calling generateTranslationExercises');
      setLastUsedWords(wordsToUse);
      const generated = await generateTranslationExercises(
        level, 
        wordsToUse, 
        resolvedGenPrompt,`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
