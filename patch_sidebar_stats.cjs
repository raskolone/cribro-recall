const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const targetMenu = `<NavLink id="tour-stats" icon={<BarChart2 size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('student-stats')} isActive={currentView === 'student-stats'}>
              {language === 'pl' ? 'Statystyki' : 'Statistics'}
          </NavLink>`;
const newMenu = `<NavLink id="tour-stats" icon={<BarChart2 size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate(isTeacher ? 'admin-stats' : 'student-stats')} isActive={currentView === 'student-stats' || currentView === 'admin-stats'}>
              {language === 'pl' ? 'Statystyki' : 'Statistics'}
          </NavLink>`;
code = code.replace(targetMenu, newMenu);

fs.writeFileSync('components/dashboard/Sidebar.tsx', code);
