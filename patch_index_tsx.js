import fs from 'fs';

let content = fs.readFileSync('index.tsx', 'utf-8');
content = "import './index.css';\n" + content;
fs.writeFileSync('index.tsx', content);
console.log("Patched index.tsx");
