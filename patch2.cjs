const fs = require('fs');
let file = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');
file = file.replace(
  `          </NavLink>                    <div className="pt-4 mt-4 border-t border-base-300">`,
  `          </NavLink>
          <NavLink 
             icon={<div className="relative"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></div>}
             isCollapsed={isDesktopCollapsed} 
             onClick={() => handleNavigate('student-stats')} 
             isActive={currentView === 'student-stats'}
          >
            <span className="">
              {language === 'pl' ? 'Statystyki' : 'Statistics'}
            </span>
          </NavLink>
          <div className="pt-4 mt-4 border-t border-base-300">`
);
fs.writeFileSync('components/dashboard/Sidebar.tsx', file);
