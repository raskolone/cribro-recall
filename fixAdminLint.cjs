const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

code = code.replace(/setIsImportingVocabulary\(true\);/g, '');
code = code.replace(/setIsImportingVocabulary\(false\);/g, '');

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
