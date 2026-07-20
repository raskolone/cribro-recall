import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(
  "if (userListRef.current && !selectedUser) {",
  "if (userListRef.current && userListRef.current.children.length > 0 && !selectedUser) {"
);
content = content.replace(
  "if (mainMenuRef.current && activeTab === null) {",
  "if (mainMenuRef.current && mainMenuRef.current.children.length > 0 && activeTab === null) {"
);
fs.writeFileSync(file, content);
console.log("Patched AdminPanel gsap");
