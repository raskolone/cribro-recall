import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

// We will animate the parent container of the list
content = content.replace(
  /const profileContainerRef = useRef<HTMLDivElement>\(null\);/,
  "const profileContainerRef = useRef<HTMLDivElement>(null);\n  const listContainerRef = useRef<HTMLDivElement>(null);"
);

content = content.replace(
  /<\/div>\n\s*\{users\.filter/,
  "</div>\n              <div ref={listContainerRef} className=\"grid grid-cols-1 gap-3 overflow-hidden\">\n                {users.filter"
);

// We need to find where the list closes and add </div>.
// Actually, it already has `<div className="grid grid-cols-1 gap-3 overflow-hidden" >`
content = content.replace(
  /<div className="grid grid-cols-1 gap-3 overflow-hidden" >/,
  '<div ref={listContainerRef} className="grid grid-cols-1 gap-3 overflow-hidden" >'
);

content = content.replace(
  /useEffect\(\(\) => \{\n\s*if \(profileContainerRef/,
  "useEffect(() => {\n    if (listContainerRef.current && !selectedUser) {\n      gsap.fromTo(listContainerRef.current,\n        { opacity: 0, height: 0 },\n        { opacity: 1, height: 'auto', duration: 0.3, ease: 'power2.out', clearProps: 'all' }\n      );\n    }\n  }, [activeTab, selectedUser, searchQuery, roleFilter, users]);\n\n  useEffect(() => {\n    if (profileContainerRef"
);

fs.writeFileSync(file, content);
console.log("Added slide down animation");
