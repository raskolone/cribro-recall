const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

code = code.replace(
  /return <AIExerciseGeneratorScreen\s+initialSetId=\{activeSetId\}/,
  `return <AIExerciseGeneratorScreen 
      onShowOnboarding={() => setShowOnboarding(true)}
      initialSetId={activeSetId}`
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
console.log('Passed onboarding prop');
