const fs = require('fs');
const file = 'components/dashboard/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/className=\{\`group w-full flex items-center \$\{(.*?)\}\`\}/, 
  "className={`group relative w-full flex items-center ${isCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-3 text-sm font-bold rounded-xl transition-all duration-200 border ${isActive ? 'bg-primary/10 border-primary/20 text-primary shadow-sm' : 'text-content-muted border-transparent hover:bg-white/5 hover:text-white'} active:scale-[0.98]`}");

content = content.replace(
  "className={`group w-full flex items-center ${isCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ease-out border ${\n      isActive\n        ? 'liquid-glass-button !rounded-xl scale-[1.02]'\n        : 'text-content-muted border-transparent liquid-glass-hover'\n    } active:scale-[0.97]`}",
  "className={`group relative z-10 hover:z-20 w-full flex items-center ${isCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-3 text-sm font-bold rounded-xl transition-all duration-200 border ${isActive ? 'bg-primary/10 border-primary/20 text-primary shadow-[0_0_15px_rgba(114,240,180,0.15)]' : 'text-content-muted border-transparent hover:bg-white/5 hover:border-white/10 hover:text-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]'} active:scale-[0.98]`}"
);

fs.writeFileSync(file, content);
