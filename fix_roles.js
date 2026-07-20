import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, searchRegex, replacement) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(searchRegex, replacement);
  fs.writeFileSync(filePath, content);
}

// 1. Dashboard.tsx
replaceInFile('components/dashboard/Dashboard.tsx', /user\?\.role === 'admin_student'/g, "user?.role === 'teacher'");

// 2. FlashcardSetsScreen.tsx
replaceInFile('components/flashcards/FlashcardSetsScreen.tsx', /user\?\.role === 'admin_student'/g, "user?.role === 'teacher'");

// 3. Sidebar.tsx
replaceInFile('components/dashboard/Sidebar.tsx', /user\?\.role === 'admin_student'/g, "user?.role === 'teacher'");

// 4. AIExerciseGeneratorScreen.tsx
replaceInFile('components/dashboard/AIExerciseGeneratorScreen.tsx', /user\?\.role === 'admin_student'/g, "user?.role === 'teacher'");

console.log("Updated roles in basic components");
