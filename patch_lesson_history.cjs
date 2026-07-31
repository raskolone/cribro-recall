const fs = require('fs');
let code = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf8');

const targetFunc = "const [selectedLog, setSelectedLog] = useState<PracticeLog | null>(null);";
const additionalLogic = `

  const isRecentLesson = (lesson: LessonRecord) => {
    if (!lesson || (!lesson.createdAt && !lesson.date)) return false;
    let checkedLessons: string[] = [];
    try {
      checkedLessons = JSON.parse(localStorage.getItem('checked_lessons') || '[]');
    } catch(e) {}
    if (checkedLessons.includes(lesson.id)) return false;
    
    const dateStr = lesson.createdAt || lesson.date;
    const date = typeof dateStr === 'string' ? new Date(dateStr) : (dateStr.toDate ? dateStr.toDate() : new Date());
    if (isNaN(date.getTime())) return false;
    const diffDays = Math.ceil(Math.abs(Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  const handleLessonSelect = (lesson: LessonRecord) => {
    setSelectedLesson(lesson);
    try {
      const local = JSON.parse(localStorage.getItem('checked_lessons') || '[]');
      if (!local.includes(lesson.id)) {
        localStorage.setItem('checked_lessons', JSON.stringify([...local, lesson.id]));
      }
    } catch(e) {}
    
    if (user?.hasNewLesson && user?.id) {
       import('firebase/firestore').then(({ doc, updateDoc }) => {
         updateDoc(doc(db, 'users', user.id), { hasNewLesson: false }).catch(console.error);
       });
    }
  };
`;

if (!code.includes("handleLessonSelect")) {
  code = code.replace(targetFunc, targetFunc + additionalLogic);
  
  // Replace onClick handler in grid mode
  code = code.replace(
    `key={lesson.id}\n                  onClick={() => setSelectedLesson(lesson)}\n                  className="bg-[#0a0e17] border border-white/10 hover:border-emerald-500/50 hover:bg-[#0e1524]`,
    `key={lesson.id}\n                  onClick={() => handleLessonSelect(lesson)}\n                  className={\`bg-[#0a0e17] hover:border-emerald-500/50 hover:bg-[#0e1524] shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_16px_36px_rgba(16,185,129,0.25)] rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group cursor-pointer hover:-translate-y-1.5 min-h-[220px] \${isRecentLesson(lesson) ? 'border-emerald-500/80 animate-pulse drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/10'}\`}`
  );

  // Replace onClick handler in list mode
  code = code.replace(
    `key={lesson.id} \n                onClick={() => setSelectedLesson(lesson)}\n                className="p-4 cursor-pointer hover:border-emerald-500/50 transition-colors liquid-glass-tile group flex items-center justify-between"`,
    `key={lesson.id} \n                onClick={() => handleLessonSelect(lesson)}\n                className={\`p-4 cursor-pointer hover:border-emerald-500/50 transition-colors group flex items-center justify-between rounded-xl border \${isRecentLesson(lesson) ? 'border-emerald-500/80 animate-pulse bg-emerald-500/10' : 'border-white/10 bg-base-200/50'}\`}`
  );
  
  // Also add a "Nowe" tag in grid view
  const gridTagTarget = `{/* Top Row: Lesson Number Badge & Date Pill */}`;
  const gridTagReplacement = `{/* Top Row: Lesson Number Badge & Date Pill */}
                    {isRecentLesson(lesson) && (
                      <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black font-extrabold text-[10px] uppercase rounded-bl-xl z-20">
                        {language === 'pl' ? 'Nowe' : 'New'}
                      </div>
                    )}`;
  code = code.replace(gridTagTarget, gridTagReplacement);

  fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', code);
}
