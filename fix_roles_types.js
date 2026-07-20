import fs from 'fs';

let file = './types.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /role: 'admin' \| 'user' \| 'admin_student';/,
  "role: 'admin' | 'user' | 'teacher';"
);

fs.writeFileSync(file, content);
console.log("Updated types.ts roles");
