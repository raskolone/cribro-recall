import fs from 'fs';

let file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(/tl\.to\(([^,]+?\.children),/g, "tl.to(gsap.utils.toArray($1),");
fs.writeFileSync(file, content);
console.log("Patched tl.to");
