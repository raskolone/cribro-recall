import fs from 'fs';
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const target = `      } catch (e) {
        console.warn("Could not save practice log or log mistakes", e);
      }
    }

    if (user && results.length > 0) {
      const score = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);
      const exercisesDetails = results.map((r) => {
        if (r.explanation === 'Ułożono poprawnie.') {
           return \`\${r.polishSentence} -> \${r.studentAnswer} [UKŁADANKA - Wymagane powtórzenie przez samodzielne Wpisywanie]\`;
        }
        return \`\${r.polishSentence} -> \${r.studentAnswer}\`;
      }).join(' | ');
      
      const logData = {
        exerciseType: 'ai_translation',
        testName: testName || undefined,
        date: new Date().toISOString(),
        isRevisionMode: false,
        score: score,
        totalWords: results.length,
        exercisesData: exercisesDetails
      };
      try {
        await addDoc(collection(db, \`users/\${user.id}/practiceLogs\`), logData);
        const allMistakes = results.flatMap(r => r.mistakes || []);
        if (allMistakes.length > 0) {
          await logMistakesToFirebase(user.id, allMistakes);
        }
      } catch (e) {
        console.warn("Could not save practice log or log mistakes", e);
      }
    }`;

const replacement = `      } catch (e) {
        console.warn("Could not save practice log or log mistakes", e);
      }
    }`;

content = content.replace(target, replacement);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
console.log("Fixed duplicate");
