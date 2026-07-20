import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /useEffect\(\(\) => \{\n\s*if \(listContainerRef\.current && !selectedUser\) \{\n\s*gsap\.fromTo\(listContainerRef\.current,\n\s*\{ opacity: 0, height: 0 \},\n\s*\{ opacity: 1, height: 'auto', duration: 0\.3, ease: 'power2\.out', clearProps: 'all' \}\n\s*\);\n\s*\}\n\s*\}, \[activeTab, selectedUser, searchQuery, roleFilter, users\]\);/,
  ""
);

content = content.replace(
  /<div ref=\{listContainerRef\} className="grid grid-cols-1 gap-3 overflow-hidden" >/,
  '<div className="grid grid-cols-1 gap-3 overflow-hidden" >'
);

fs.writeFileSync(file, content);
console.log("Removed listContainerRef animation");
