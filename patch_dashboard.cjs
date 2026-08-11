const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

// Add _autoGenerate tracking to onNavigate inside flashcard-study
content = content.replace(
  /(if \(extra && extra\.initialMode\) \{\s*\(window as any\)\._initialStudyMode = extra\.initialMode === 'match' \? 'matching' : extra\.initialMode;\s*\})/,
  `$1\n          if (extra && extra.autoGenerate !== undefined) {\n            (window as any)._autoGenerate = extra.autoGenerate;\n          }`
);

// Add autoGenerate prop to AIExerciseGeneratorScreen
content = content.replace(
  /initialSetId=\{activeSetId\}/,
  `initialSetId={activeSetId}\n      autoGenerate={(window as any)._autoGenerate}`
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', content);
