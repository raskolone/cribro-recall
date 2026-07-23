const fs = require('fs');
const file = 'components/dashboard/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /className=\{\`group w-full flex items-center \$\{isDesktopCollapsed \? 'px-4 md:px-0 md:justify-center' : 'px-4'\} py-2.5 text-sm font-bold rounded-xl transition-all duration-200 text-red-400 hover:bg-red-500\/10\`\}/,
  "className={`group relative z-10 hover:z-20 w-full flex items-center ${isDesktopCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-3 text-sm font-bold rounded-xl transition-all duration-200 border border-transparent text-red-400 hover:bg-red-500/10 active:scale-[0.98]`}"
);

fs.writeFileSync(file, content);
