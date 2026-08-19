const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

code = code.replace(
  '<div className="flex h-screen bg-base-100">',
  '<div className="flex h-[100dvh] w-full bg-base-100 overflow-hidden">'
);

code = code.replace(
  '<main className="flex-1 overflow-y-auto relative">',
  '<main className="flex-1 overflow-y-auto overflow-x-hidden relative min-w-0">'
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
console.log('Dashboard.tsx updated with 100dvh and overflow-x-hidden');
