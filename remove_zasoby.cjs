const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const zasobyStr = `          {isTeacher && (
            <NavLink icon={<Database size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('topic-database')} isActive={currentView === 'topic-database'}>
                {language === 'pl' ? 'Zasoby' : 'Resources'}
            </NavLink>
          )}`;

if (content.includes(zasobyStr)) {
  content = content.replace(zasobyStr, '');
  fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
  console.log('Removed Zasoby from Sidebar');
} else {
  console.log('Zasoby string not found');
}
