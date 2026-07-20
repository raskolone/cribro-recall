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
  content = content.replace(/gsap\.fromTo\(([^,]+?\.children),/g, "gsap.fromTo(gsap.utils.toArray($1),");
  content = content.replace(/gsap\.to\(([^,]+?\.children),/g, "gsap.to(gsap.utils.toArray($1),");
  content = content.replace(/gsap\.set\(([^,]+?\.children),/g, "gsap.set(gsap.utils.toArray($1),");
  fs.writeFileSync(file, content);
}
console.log("Patched toArray");
