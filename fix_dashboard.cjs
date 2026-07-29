const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const mainRegex = /<main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8">/;
code = code.replace(mainRegex, `<main className={\`flex-1 overflow-y-auto pb-24 md:pb-8 \${(!isTeacher && view === 'dashboard') || view === 'ai-generator' ? 'p-0 sm:p-6 lg:p-8' : 'p-4 sm:p-6 lg:p-8'}\`}>`);

const headerRegex = /<header className="relative z-40 flex flex-col md:flex-row md:justify-between items-center mb-6 p-4 rounded-2xl liquid-glass-card gap-4">/;
code = code.replace(headerRegex, `<header className={\`relative z-40 flex-col md:flex-row md:justify-between items-center mb-6 p-4 rounded-2xl liquid-glass-card gap-4 \${(!isTeacher && view === 'dashboard') || view === 'ai-generator' ? 'hidden md:flex' : 'flex'}\`}>`);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
