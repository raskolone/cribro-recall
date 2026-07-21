const fs = require('fs');
const path = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("setFormMode('create');", "setLessonRecordModalMode('edit');");
content = content.replace("setShowLessonForm(true);", "setShowLessonRecordModal(true);\n    setEditingRecordId(null);");

fs.writeFileSync(path, content);
console.log("Patched Form variables");
