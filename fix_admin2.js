import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /requirePasswordChange: true\n      \};/g,
  "requirePasswordChange: true,\n        tempPassword: password\n      };"
);

fs.writeFileSync(file, content);
console.log("Fixed AdminPanel.tsx again");
