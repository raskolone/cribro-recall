const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

code = code.replace(
  /<AIExerciseGeneratorScreen key={`ai-gen-\$\{exerciseResetKey\}`} initialSetId=\{activeSetId\} onStartPractice=\{startPractice\} onExerciseStateChange=\{setIsExerciseActive\} \/>/g,
  '<AIExerciseGeneratorScreen key={`ai-gen-${exerciseResetKey}`} initialSetId={activeSetId} onStartPractice={startPractice} onExerciseStateChange={setIsExerciseActive} onOpenSidebar={() => setIsSidebarOpen(true)} />'
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
