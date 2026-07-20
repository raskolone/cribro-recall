import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /requirePasswordChange: true,\s*tempPassword: newUserPassword, tempPassword: newPasswordForUser \}\);/,
  "requirePasswordChange: true, tempPassword: newPasswordForUser });"
);

fs.writeFileSync(file, content);
console.log("Fixed AdminPanel.tsx");
