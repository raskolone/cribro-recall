const fs = require('fs');
let content = fs.readFileSync('types.ts', 'utf8');
content = content.replace(/hasNewVocabulary\?: boolean;/, 'hasNewVocabulary?: boolean;\n  hasNewLesson?: boolean;');
fs.writeFileSync('types.ts', content);
