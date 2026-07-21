const fs = require('fs');
const path = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("setLessonFormNotes(data.revisionNotes);", "setLessonFormSummary(data.revisionNotes);");
content = content.replace("setLessonFormVocabulary(data.vocabularyText);", "setLessonFormWords(data.vocabularyText);");

fs.writeFileSync(path, content);
console.log("Patched Form variable names");
