import fs from 'fs';
let content = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf-8');

const regex = /\/\/\s*Default to dashboard view\s*const isTeacher = user\?\.role === 'admin' \|\| user\?\.role === 'admin_student';\s*return \(/;

const newStr = `    // Default to dashboard view
    const isTeacher = user?.role === 'admin' || user?.role === 'admin_student';

    if (!isTeacher && view === 'dashboard') {
      return <AIExerciseGeneratorScreen key={\`ai-gen-\${exerciseResetKey}\`} initialSetId={activeSetId} onStartPractice={startPractice} onExerciseStateChange={setIsExerciseActive} />;
    }

    return (`

if (regex.test(content)) {
  content = content.replace(regex, newStr);
  fs.writeFileSync('components/dashboard/Dashboard.tsx', content);
  console.log("Patched correctly");
} else {
  console.log("Not found");
}
