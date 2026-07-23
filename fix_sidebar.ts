import * as fs from 'fs';
const content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

// I will just rewrite the bottom part of Sidebar manually and fix NavItem.
// NavItem should be:
const navItemCorrect = `<button id={id}
    onClick={onClick}
    title={isCollapsed ? (typeof children === 'string' ? children : undefined) : undefined}
    className={\`group relative z-10 hover:z-20 w-full flex items-center \${isCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-3 text-sm font-bold rounded-xl transition-all duration-200 border \${isActive ? 'bg-primary/10 border-primary/20 text-primary shadow-[0_0_15px_rgba(114,240,180,0.15)]' : 'text-content-muted border-transparent hover:bg-white/5 hover:border-white/10 hover:text-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]'} active:scale-[0.98]\`}
  >
    {icon && (
      <div className={\`flex items-center justify-center transition-transform duration-300 \${isCollapsed ? 'mr-3 md:mr-0' : 'mr-3'} group-hover:scale-110 group-hover:text-primary \${isActive ? 'scale-110 text-primary' : ''}\`}>
        {icon}
      </div>
    )}
    <span className={\`transition-all duration-300 group-hover:translate-x-0.5 \${isCollapsed ? 'md:hidden' : 'block'}\`}>{children}</span>
  </button>`;

// And I'll find where I put the language switcher and remove it.
