const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const target = `      const logData: any = {
        exerciseType: 'ai_translation',
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails,
        detailedFeedback: detailedFeedback
      };`;

const replacement = `      // Determine set display name
      let setDisplayName = 'Nieznany zestaw';
      if (selectedSetId === 'basket') setDisplayName = 'Koszyk Słówek';
      else if (selectedSetId === 'grammar') setDisplayName = 'Gramatyka';
      else if (selectedSetId === 'lessons') setDisplayName = 'Słówka z lekcji';
      else if (selectedSetId.startsWith('vocab-')) {
         const vs = vocabularySets.find(s => \`vocab-\${s.id}\` === selectedSetId);
         if (vs) setDisplayName = vs.name;
      } else if (selectedSetId === 'all') setDisplayName = 'Cały materiał';
      else {
         const vs = vocabularySets.find(s => \`set-\${s.id}\` === selectedSetId || s.id === selectedSetId);
         if (vs) setDisplayName = vs.name;
      }

      const logData: any = {
        exerciseType: 'ai_translation',
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails,
        detailedFeedback: detailedFeedback,
        exerciseFormat: exerciseFormat,
        practiceMode: practiceMode,
        selectedSetId: selectedSetId,
        setDisplayName: setDisplayName
      };`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
