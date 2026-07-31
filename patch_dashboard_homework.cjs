const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const target = `    if (view === 'settings') {`;
const replacement = `    if (view === 'homework') {
      return <AssignedTasks onStudySet={() => {}} />;
    }
    if (view === 'settings') {`;

code = code.replace(target, replacement);
fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
