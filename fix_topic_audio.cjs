const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf8');

// import TTSButtons
if (!code.includes("import TTSButtons")) {
  code = code.replace(
    "import Button from '../ui/Button';",
    "import Button from '../ui/Button';\nimport TTSButtons from '../flashcards/TTSButtons';"
  );
}

// replace vocabulary display in TopicDatabaseScreen
// we need to find how w is displayed. Let's inspect that part.
