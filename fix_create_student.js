import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /<button onClick=\{() => setShowCreateStudentModal\(true\)\} className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-primary\/90 transition-colors">\n\s*\+ Dodaj kursanta\n\s*<\/button>/,
  "{currentUser?.role === 'admin' && (\n              <button onClick={() => setShowCreateStudentModal(true)} className=\"px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors\">\n                + Dodaj kursanta\n              </button>\n            )}"
);

fs.writeFileSync(file, content);
console.log("Restricted create student");
