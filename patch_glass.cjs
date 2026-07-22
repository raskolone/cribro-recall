const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

// Replace the main top buttons (kafelki)
code = code.replace(
  /className="flex flex-col items-center justify-center p-8 bg-base-200\/50 rounded-2xl border border-white\/5 hover:border-primary\/50 hover:bg-base-200 transition-all duration-300 group"/g,
  'className="flex flex-col items-center justify-center p-8 rounded-2xl liquid-glass-tile group"'
);

// Replace history lesson records hover
// className="relative group cursor-pointer hover:border-primary/50 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg bg-base-200/50 p-4 rounded-xl"
code = code.replace(
  /className="relative group cursor-pointer hover:border-primary\/50 transition-all duration-300 hover:scale-\[1.01\] hover:shadow-lg bg-base-200\/50 p-4 rounded-xl"/g,
  'className="relative group cursor-pointer p-4 rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5"'
);

// Replace vocabulary sets hover
// className="p-4 bg-base-200/50 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer rounded-xl"
code = code.replace(
  /className="p-4 bg-base-200\/50 hover:border-primary\/50 transition-all duration-300 hover:scale-\[1.02\] hover:shadow-lg cursor-pointer rounded-xl"/g,
  'className="p-4 cursor-pointer rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5"'
);

// Replace user rows hover
code = code.replace(
  /className="hover:bg-white\/5 transition-colors cursor-pointer"/g,
  'className="cursor-pointer liquid-glass-hover"'
);

// Practice logs rows
code = code.replace(
  /className="hover:bg-white\/10 transition-colors cursor-pointer"/g,
  'className="cursor-pointer liquid-glass-hover"'
);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('patched AdminPanel.tsx');

let statsCode = fs.readFileSync('components/admin/TeacherDashboardStats.tsx', 'utf8');

// Stats cards
statsCode = statsCode.replace(
  /className="bg-base-200 p-4 rounded-xl border border-white\/5 hover:border-primary\/50 hover:scale-\[1.02\] hover:shadow-lg transition-all duration-300"/g,
  'className="p-4 rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5"'
);

statsCode = statsCode.replace(
  /className="bg-base-200 p-6 rounded-xl border border-white\/5 hover:border-primary\/50 hover:scale-\[1.01\] hover:shadow-lg transition-all duration-300"/g,
  'className="p-6 rounded-xl liquid-glass-hover bg-base-200/40 border border-white/5"'
);

fs.writeFileSync('components/admin/TeacherDashboardStats.tsx', statsCode);
console.log('patched TeacherDashboardStats.tsx');

