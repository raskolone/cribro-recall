const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const updateTaskStatus = `
      try {
        await addDoc(collection(db, \`users/\${user.id}/practiceLogs\`), logData);
        const allMistakes = results.flatMap(r => r.mistakes || []);
        if (allMistakes.length > 0) {
          await logMistakesToFirebase(user.id, allMistakes);
        }

        // mark special task as completed
        if (selectedSetId?.startsWith('special-task-')) {
           const taskId = selectedSetId.replace('special-task-', '');
           import('firebase/firestore').then(({ doc, updateDoc }) => {
              updateDoc(doc(db, 'specialTasks', taskId), { status: 'completed' });
           });
        }
      } catch (e) {
`;

code = code.replace(
  /try \{\n\s*await addDoc\(collection\(db, `users\/\$\{user\.id\}\/practiceLogs`\), logData\);\n\s*const allMistakes = results\.flatMap\(r => r\.mistakes \|\| \[\]\);\n\s*if \(allMistakes\.length > 0\) \{\n\s*await logMistakesToFirebase\(user\.id, allMistakes\);\n\s*\}\n\s*\} catch \(e\) \{/g,
  updateTaskStatus.trim()
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('patched task status');
