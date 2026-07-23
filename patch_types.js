const fs = require('fs');
const file = 'types.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /export type TestQuestionType = 'multiple_choice' \| 'fill_in_blank' \| 'translation' \| 'matching' \| 'writing';/,
  "export type TestQuestionType = 'multiple_choice' | 'fill_in_blank' | 'translation' | 'matching' | 'writing' | 'find_mistake';"
);

fs.writeFileSync(file, content);
