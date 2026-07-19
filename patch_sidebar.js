import fs from 'fs';
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf-8');

const targetStr = `  const { user, logout } = useAuth();
  const { language } = useLanguage();

  const handleNavigate = (view: any) => {`;

const newStr = `  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'admin_student';

  const handleNavigate = (view: any) => {`;

content = content.replace(targetStr, newStr);

const menuTarget = `          <NavLink icon={<Sparkles size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('ai-generator')} isActive={currentView === 'ai-generator'}>
              {language === 'pl' ? 'Widok kursanta' : 'Student View'}
          </NavLink>`;

const menuReplacement = `          {isTeacher && (
            <NavLink icon={<Sparkles size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('ai-generator')} isActive={currentView === 'ai-generator'}>
                {language === 'pl' ? 'Widok kursanta' : 'Student View'}
            </NavLink>
          )}`;

content = content.replace(menuTarget, menuReplacement);
fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
