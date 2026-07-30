const fs = require('fs');
const path = 'components/landing/LandingPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("import gsap from 'gsap';", "");
content = content.replace(/useEffect\(\(\) => \{\n\s+if \(containerRef\.current && containerRef\.current\.children\.length > 0\) \{\n\s+gsap\.fromTo\(gsap\.utils\.toArray\(containerRef\.current\.children\),\s*\{\s*opacity: 0, y: 30\s*\},.*?\);\n\s+\}\n\s+\}, \[\]\);/s, "");

fs.writeFileSync(path, content, 'utf8');
