const fs = require('fs');
const files = [
  'components/dashboard/Dashboard.tsx',
  'components/dashboard/Sidebar.tsx',
  'components/dashboard/AIExerciseGeneratorScreen.tsx',
  'components/flashcards/FlashcardSetsScreen.tsx'
];
files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  try {
    require('@babel/core').transformSync(code, {
      presets: ['@babel/preset-typescript', '@babel/preset-react'],
      filename: f
    });
    console.log(f, "compiled successfully");
  } catch(e) {
    console.error(f, "ERROR:", e.message);
  }
});
