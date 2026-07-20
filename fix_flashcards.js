import fs from 'fs';

let file = 'components/flashcards/FlashcardSetsScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');

// I will just use regex to remove from the first `const handlePreviewSet` 
// down to the first `if (containerRef.current.children.length > 0) {`
content = content.replace(/  const handlePreviewSet = async \([^]*?(?=const handlePreviewSet = async \()/, '');

fs.writeFileSync(file, content);
console.log("Fixed FlashcardSetsScreen");
