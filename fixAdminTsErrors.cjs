const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

code = code.replace("description: u.studentDescription", "description: u.description");
code = code.replace("revisionNotes: lesson.revisionNotes,", "lessonSummary: lesson.revisionNotes,\n               createdAt: new Date().toISOString(),\n               updatedAt: new Date().toISOString(),");

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
