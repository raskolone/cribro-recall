import fs from 'fs';

let file = 'components/flashcards/FlashcardSetsScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');

// The file got duplicated `handlePreviewSet`.
// I will strip out the first `const handlePreviewSet` all the way to `const containerRef = useRef<HTMLDivElement>(null);` and the broken `useEffect`.
// Let's replace the whole block manually.

content = content.replace(/const handlePreviewSet = async[\s\S]*?const handlePreviewSet = async/, `const handlePreviewSet = async`);

// Now let's see if we still have a broken useEffect
content = content.replace(/  const containerRef = useRef<HTMLDivElement>\(null\);\s*useEffect\(\(\) => \{\s*if \(containerRef\.current\.children && e\.key === 'Escape'\) \{\s*setSetToDelete\(null\);\s*setPreviewSetId\(null\);\s*setSetToDelete\(null\);\s*\}\s*\};\s*window\.addEventListener\('keydown', handleKeyDown\);\s*return \(\) => window\.removeEventListener\('keydown', handleKeyDown\);\s*\}, \[\]\);/, '');

fs.writeFileSync(file, content);
console.log("Fixed FlashcardSetsScreen");
