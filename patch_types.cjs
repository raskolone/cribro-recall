const fs = require('fs');
const file = 'types.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /export type TestQuestionType = 'multiple_choice' \| 'fill_in_blank' \| 'translation' \| 'matching' \| 'writing';/,
  "export type TestQuestionType = 'multiple_choice' | 'fill_in_blank' | 'translation' | 'matching' | 'writing' | 'find_mistake';"
);

if(!content.includes("instructions?: string;")) {
  content = content.replace(
    /scope: string; \/\/ Zakres materiału/,
    "scope: string; // Zakres materiału\n  instructions?: string;"
  );
}

fs.writeFileSync(file, content);
