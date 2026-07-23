const fs = require('fs');
const file = 'components/admin/AdminTestGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const handleGenerate = async \(\) => {\n    if \(selectedTypes\.includes\('writing'\)\) {\n      const topic = window\.prompt\("Wybrałeś zadanie Writing. Podaj temat lub instrukcje dla writingu:"\);\n      if \(\!topic\) return alert\("Temat writingu jest wymagany, aby wygenerować test z tym typem zadania."\);\n      setScope\(prev => prev \+ "\\n\\n\[TEMAT WRITINGU\]: " \+ topic\);\n    }/,
  `const handleGenerate = async () => {\n    let currentScope = scope;\n    if (selectedTypes.includes('writing')) {\n      const topic = window.prompt("Wybrałeś zadanie Writing. Podaj temat lub instrukcje dla writingu:");\n      if (!topic) return alert("Temat writingu jest wymagany, aby wygenerować test z tym typem zadania.");\n      currentScope = scope + "\\n\\n[TEMAT WRITINGU]: " + topic;\n      setScope(currentScope);\n    }`
);

content = content.replace(
  /const questions = await generateTest\(user\.level \|\| 'B1', testTitle, scope, profile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, fileData, driveFile \? \{ id: driveFile\.id, mimeType: driveFile\.mimeType, token: driveFile\.token \} : undefined\);/,
  "const questions = await generateTest(user.level || 'B1', testTitle, currentScope, profile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, fileData, driveFile ? { id: driveFile.id, mimeType: driveFile.mimeType, token: driveFile.token } : undefined);"
);

fs.writeFileSync(file, content);
