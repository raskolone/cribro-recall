const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

code = code.replace(
  "onNavigate={(newView) => setView(newView)}",
  "onNavigate={(newView) => setView(newView)}\n        onStartPractice={(exercise) => console.log('start practice', exercise)}"
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
