const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const target = `if (extra && extra.initialMode) (window as any)._initialStudyMode = extra.initialMode;`;
const replacement = `if (extra && extra.initialMode) {
          (window as any)._initialStudyMode = extra.initialMode === 'match' ? 'matching' : extra.initialMode;
        }`;
code = code.replace(target, replacement);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
