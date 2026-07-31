const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

// Replace Flashcards NavLink
const flashcardsNav = `<NavLink id="tour-flashcards" icon={<Library size={20} />} isCollapsed={isDesktopCollapsed} onClick={() => handleNavigate('flashcard-sets')} isActive={currentView === 'flashcard-sets'}>
              {language === 'pl' ? 'Moje słownictwo' : 'My Word Lists'}
          </NavLink>`;

const flashcardsNewNav = `<NavLink 
            id="tour-flashcards" 
            className={user?.hasNewVocabulary ? "!bg-emerald-500/20 !text-emerald-300 !border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.4)] animate-pulse font-extrabold" : ""}
            icon={
              <div className="relative">
                <Library size={20} className={user?.hasNewVocabulary ? "text-emerald-400 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.9)] scale-110" : ""} />
              </div>
            }
            isCollapsed={isDesktopCollapsed} 
            onClick={() => {
              if (user?.hasNewVocabulary && user?.id) {
                 import('firebase/firestore').then(({ doc, updateDoc }) => {
                   updateDoc(doc(db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error);
                 });
              }
              handleNavigate('flashcard-sets');
            }} 
            isActive={currentView === 'flashcard-sets'}
          >
              {language === 'pl' ? 'Moje słownictwo' : 'My Word Lists'}
          </NavLink>`;

code = code.replace(flashcardsNav, flashcardsNewNav);


// Replace History NavLink
const historyTarget = `<NavLink 
            id="tour-history" 
            className={(user?.hasNewLesson || user?.hasNewVocabulary) ? "!bg-emerald-500/20 !text-emerald-300 !border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.4)] animate-pulse font-extrabold" : ""}
            icon={
              <div className="relative">
                <History size={20} className={(user?.hasNewLesson || user?.hasNewVocabulary) ? "text-emerald-400 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.9)] scale-110" : ""} />
              </div>
            } 
            isCollapsed={isDesktopCollapsed} 
            onClick={() => {
              if ((user?.hasNewLesson || user?.hasNewVocabulary) && user?.id) {
                 import('firebase/firestore').then(({ doc, updateDoc }) => {
                   updateDoc(doc(db, 'users', user.id), { hasNewLesson: false, hasNewVocabulary: false }).catch(console.error);
                 });
              }
              handleNavigate('lesson-history');
            }} 
            isActive={currentView === 'lesson-history'}
          >`;

const historyReplacement = `<NavLink 
            id="tour-history" 
            className={user?.hasNewLesson ? "!bg-emerald-500/20 !text-emerald-300 !border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.4)] animate-pulse font-extrabold" : ""}
            icon={
              <div className="relative">
                <History size={20} className={user?.hasNewLesson ? "text-emerald-400 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.9)] scale-110" : ""} />
              </div>
            } 
            isCollapsed={isDesktopCollapsed} 
            onClick={() => {
              if (user?.hasNewLesson && user?.id) {
                 import('firebase/firestore').then(({ doc, updateDoc }) => {
                   updateDoc(doc(db, 'users', user.id), { hasNewLesson: false }).catch(console.error);
                 });
              }
              handleNavigate('lesson-history');
            }} 
            isActive={currentView === 'lesson-history'}
          >`;
          
code = code.replace(historyTarget, historyReplacement);

fs.writeFileSync('components/dashboard/Sidebar.tsx', code);
