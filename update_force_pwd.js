import fs from 'fs';

let file = 'components/auth/ForcePasswordChangeScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /import \{ doc, updateDoc \} from 'firebase\/firestore';/,
  "import { doc, updateDoc, deleteField } from 'firebase/firestore';"
);

content = content.replace(
  /requirePasswordChange: false \}\);/g,
  "requirePasswordChange: false, tempPassword: deleteField() });"
);

fs.writeFileSync(file, content);
console.log("Updated ForcePasswordChangeScreen.tsx");
