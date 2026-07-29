const fs = require('fs');
let file = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetStr = `      if (selectedSetId === 'grammar' && selectedGrammarTopic && selectedGrammarTopic.sentences) {
         if (selectedGrammarTopic.chapterIndex === 0) {
            finalGenPrompt += \`\\n\\n[TŁUMACZENIA - Gramatyka 1]: Wygeneruj proste zdania na poziomie A1-A2, używając tych wzorów jako inspiracji:\\n\${selectedGrammarTopic.sentences}\`;
         } else {
            finalGenPrompt += \`\\n\\n[TŁUMACZENIA]: Wygeneruj ćwiczenia, bazując ściśle na tych zdaniach, lekko je modyfikując: \\n\${selectedGrammarTopic.sentences}\`;
         }
      }`;

const replacementStr = `      if (selectedSetId === 'grammar' && selectedGrammarTopic && selectedGrammarTopic.sentences) {
         finalGenPrompt += \`\\n\\n[TŁUMACZENIA - GRAMATYKA (CRITICAL REGION)]: Zignoruj globalne wytyczne poziomu kursanta. Wygeneruj zdania adekwatne do podanych przykładów z bazy. Używaj konstrukcji gramatycznych z przykładów. Przykłady z bazy:\\n\${selectedGrammarTopic.sentences}\`;
      }`;

file = file.replace(targetStr, replacementStr);

const targetCall = `const generated = await generateTranslationExercises(level, wordsToUse, resolvedGenPrompt, lessonContextString, studentProfileContext, practiceMode === 'time' ? 10 : numSentences, pastExercisesContext);`;
const replacementCall = `const generated = await generateTranslationExercises(level, wordsToUse, resolvedGenPrompt, lessonContextString, studentProfileContext, practiceMode === 'time' ? 10 : numSentences, pastExercisesContext, selectedSetId === 'grammar');`;

file = file.replace(targetCall, replacementCall);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', file);
