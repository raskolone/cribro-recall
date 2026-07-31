const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf8');

if (!code.includes("import TTSButtons")) {
  code = code.replace(
    "import AddResourceModal from './AddResourceModal';",
    "import AddResourceModal from './AddResourceModal';\nimport TTSButtons from '../flashcards/TTSButtons';"
  );
  fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
}
