const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const targetHistory = `<NavLink id="tour-history" icon={<History size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('lesson-history')} isActive={currentView === 'lesson-history'}>
              {language === 'pl' ? 'Historia lekcji' : 'Lesson History'}
          </NavLink>`;

const repHistory = `<NavLink id="tour-history" icon={
            <div className="relative">
              <History size={20} className={user?.hasNewLesson ? "text-primary animate-pulse" : ""} />
              {user?.hasNewLesson && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-black"></span>
                </span>
              )}
            </div>
          } isCollapsed={isDesktopCollapsed} onClick={() => {
            if (user?.hasNewLesson && user?.id) {
               import('firebase/firestore').then(({ doc, updateDoc }) => {
                 updateDoc(doc(import('../../firebase').then(m=>m.db), 'users', user.id), { hasNewLesson: false }).catch(console.error);
               });
            }
            handleNavigate('lesson-history');
          }} isActive={currentView === 'lesson-history'}>
              {language === 'pl' ? 'Historia lekcji' : 'Lesson History'}
          </NavLink>`;

if (content.includes(targetHistory)) {
  content = content.replace(targetHistory, repHistory);
  fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
  console.log("Sidebar patched!");
} else {
  console.log("Could not find target in Sidebar.");
}
