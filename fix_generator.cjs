const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(
  /<div className="max-w-2xl mx-auto mt-4 px-4">/,
  '<div className="max-w-2xl mx-auto sm:mt-4 w-full">'
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
