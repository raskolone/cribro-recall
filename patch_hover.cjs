const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

// 1. Historia -> Historia lekcji in labels
code = code.replace(
  /<h3 className="font-bold text-lg">Historia<\/h3>/g, 
  '<h3 className="font-bold text-lg">Historia lekcji</h3>'
);
code = code.replace(
  /{activeTab === 'history' && 'Wybierz kursanta \\(Historia\\)'}/g, 
  "{activeTab === 'history' && 'Wybierz kursanta (Historia lekcji)'}"
);
code = code.replace(
  /{ id: 'history', label: 'Historia' }/g, 
  "{ id: 'history', label: 'Historia lekcji' }"
);
code = code.replace(
  /{activeTab === 'history' && 'Historia'}/g, 
  "{activeTab === 'history' && 'Historia lekcji'}"
);

// 2. Add hover effect to lesson records
code = code.replace(
  /className="relative group cursor-pointer hover:border-primary\/50 transition-colors bg-base-200\/50 p-4"/g,
  'className="relative group cursor-pointer hover:border-primary/50 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg bg-base-200/50 p-4 rounded-xl"'
);

// 3. Add hover effect to vocabulary sets
code = code.replace(
  /className="p-4 bg-base-200\/50 hover:border-primary\/50 transition-colors cursor-pointer"/g,
  'className="p-4 bg-base-200/50 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer rounded-xl"'
);

// 4. Change table row hover effect just in case
code = code.replace(
  /<tr key=\{log.id\} className="hover:bg-white\/5 transition-colors">/g,
  '<tr key={log.id} className="hover:bg-white/10 transition-colors cursor-pointer">'
);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('patched AdminPanel.tsx');

let statsCode = fs.readFileSync('components/admin/TeacherDashboardStats.tsx', 'utf8');

statsCode = statsCode.replace(
  /className="bg-base-200 p-4 rounded-xl border border-white\/5"/g,
  'className="bg-base-200 p-4 rounded-xl border border-white/5 hover:border-primary/50 hover:scale-[1.02] hover:shadow-lg transition-all duration-300"'
);

statsCode = statsCode.replace(
  /className="bg-base-200 p-6 rounded-xl border border-white\/5"/g,
  'className="bg-base-200 p-6 rounded-xl border border-white/5 hover:border-primary/50 hover:scale-[1.01] hover:shadow-lg transition-all duration-300"'
);

fs.writeFileSync('components/admin/TeacherDashboardStats.tsx', statsCode);
console.log('patched TeacherDashboardStats.tsx');

