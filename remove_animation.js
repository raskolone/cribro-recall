import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Remove the useEffect
content = content.replace(
  /useEffect\(\(\) => \{\n\s*if \(userListRef\.current && userListRef\.current\.children\.length > 0 && !selectedUser\) \{\n\s*gsap\.fromTo\(gsap\.utils\.toArray\(userListRef\.current\.children\),\n\s*\{ opacity: 0, scaleY: 0, transformOrigin: "top" \},\n\s*\{ opacity: 1, scaleY: 1, duration: 0\.3, ease: "power2\.out", stagger: 0\.04, clearProps: "all" \}\n\s*\);\n\s*\}\n\s*\}, \[activeTab, selectedUser, searchQuery, roleFilter, users\]\);/,
  ""
);

content = content.replace(
  /const userListRef = useRef<HTMLDivElement>\(null\);/,
  ""
);

content = content.replace(
  /ref=\{userListRef\}/,
  ""
);

fs.writeFileSync(file, content);
console.log("Removed animation");
