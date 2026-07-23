const fs = require('fs');
const file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /className="liquid-glass-hover bg-base-200\/40 border border-white\/5 p-4 rounded-xl cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"/g,
  'className="liquid-glass-hover bg-base-200/40 border border-white/5 p-5 md:p-6 rounded-2xl cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"'
);
content = content.replace(
  /<div className="font-bold text-lg group-hover:text-primary transition-colors">/g,
  '<div className="font-bold text-xl mb-1 group-hover:text-primary transition-colors">'
);
content = content.replace(
  /<div className="text-sm text-content-muted">\{u\.username\}<\/div>/g,
  '<div className="text-base text-content-muted">{u.username}</div>'
);
content = content.replace(
  /px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider/g,
  'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider'
);

fs.writeFileSync(file, content);
