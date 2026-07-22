const fs = require('fs');

// 1. AdminPanel users list
let adminPanel = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');
adminPanel = adminPanel.replace(
  /className="bg-base-200 border border-white\/5 p-4 rounded-xl cursor-pointer hover:border-primary\/30 hover:bg-base-200\/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"/g,
  'className="liquid-glass-hover bg-base-200/40 border border-white/5 p-4 rounded-xl cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"'
);
fs.writeFileSync('components/admin/AdminPanel.tsx', adminPanel);
console.log('patched users list in AdminPanel');

// 2. TeacherDashboardActivity rows
let activityPanel = fs.readFileSync('components/admin/TeacherDashboardActivity.tsx', 'utf8');
activityPanel = activityPanel.replace(
  /className="flex items-center justify-between bg-base-200 p-4 rounded-xl border border-white\/5"/g,
  'className="flex items-center justify-between bg-base-200/40 p-4 rounded-xl border border-white/5 liquid-glass-hover"'
);
fs.writeFileSync('components/admin/TeacherDashboardActivity.tsx', activityPanel);
console.log('patched rows in TeacherDashboardActivity');
