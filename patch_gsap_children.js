import fs from 'fs';

const files = [
  'components/dashboard/Sidebar.tsx',
  'components/dashboard/AIExerciseGeneratorScreen.tsx',
  'components/landing/LandingPage.tsx',
  'components/flashcards/FlashcardSetsScreen.tsx',
  'components/admin/AdminPanel.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/if \(([^]+?\.current)\) {\s*gsap/g, "if ($1 && $1.children && $1.children.length > 0) {\n      gsap");
  content = content.replace(/if \(([^]+?\.current)\) {\n\s*gsap/g, "if ($1 && $1.children && $1.children.length > 0) {\n      gsap");
  fs.writeFileSync(file, content);
}
console.log("Patched children checks");
