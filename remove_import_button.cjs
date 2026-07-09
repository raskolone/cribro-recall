const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const regex = /<Button size="sm" variant="secondary" onClick=\{handleImportVocabulary\} isLoading=\{isImportingVocabulary\}>Import Słownictwa<\/Button>/g;
code = code.replace(regex, '');

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
