import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /gsap\.fromTo\(gsap\.utils\.toArray\(userListRef\.current\.children\),\n\s*\{ opacity: 0, x: -30 \},\n\s*\{ opacity: 1, x: 0, duration: 0\.4, ease: "power2\.out", stagger: 0\.05, clearProps: "all" \}\n\s*\);/,
  'gsap.fromTo(gsap.utils.toArray(userListRef.current.children),\n        { opacity: 0, scaleY: 0, transformOrigin: "top" },\n        { opacity: 1, scaleY: 1, duration: 0.3, ease: "power2.out", stagger: 0.04, clearProps: "all" }\n      );'
);

fs.writeFileSync(file, content);
console.log("Updated animation");
