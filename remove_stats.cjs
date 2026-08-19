const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const statsStr = `          {isTeacher && (
            <NavLink id="tour-stats" icon={<BarChart2 size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('admin-stats')} isActive={currentView === 'admin-stats'}>
                {language === 'pl' ? 'Statystyki' : 'Statistics'}
            </NavLink>
          )}`;

if (content.includes(statsStr)) {
  content = content.replace(statsStr, '');
  fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
  console.log('Removed Statystyki from Sidebar');
} else {
  console.log('Statystyki string not found');
}
