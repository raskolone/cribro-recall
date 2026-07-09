const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

code = code.replace(/const \[isImportingVocabulary, setIsImportingVocabulary\] = useState\(false\);\n/, '');

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
