const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardSetsScreen.tsx', 'utf8');

const listRowRender = `
  const renderSetRow = (set: FlashcardSet, type: 'lesson' | 'teacher') => (
    <div key={set.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-base-200/50 p-4 rounded-xl border border-white/5 hover:border-primary/30 transition-colors gap-4 relative overflow-hidden">
      {isRecent(set.createdAt) && (
         <div className="absolute top-0 right-0 px-2 py-1 bg-secondary text-secondary-content text-[10px] font-bold uppercase rounded-bl-lg z-10 animate-pulse">
           {language === 'pl' ? 'Nowe' : 'New'}
         </div>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-lg font-bold hover:text-primary transition-colors cursor-pointer hover:underline" onClick={() => handlePreviewSet(set.id)} title={language === "pl" ? "Podgląd słownictwa" : "Preview vocabulary"}>
            {set.title}
          </h3>
          <span className={\`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold \${type === 'lesson' ? 'bg-amber-500/10 text-amber-500' : 'bg-secondary/10 text-secondary'}\`}>
            {type === 'lesson' ? (language === 'pl' ? 'Lekcja' : 'Lesson') : (language === 'pl' ? 'Nauczyciel' : 'Teacher')}
          </span>
        </div>
        
        {type === 'lesson' && set.lessonTopic && (
          <div className="text-sm text-content-muted line-clamp-1 mb-2">
            {set.lessonTopic}
          </div>
        )}
        
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-content-muted mt-2">
          <span className="inline-flex items-center bg-base-300 px-2 py-0.5 rounded-md text-content">
            {set.cardCount} {t('flashcards.cards')}
          </span>
          <span className="flex items-center gap-2">
            {language === 'pl' ? 'Opanowanie:' : 'Mastery:'} 
            <span className={setMastery[set.id] >= 80 ? 'text-green-400' : 'text-primary'}>{setMastery[set.id] || 0}%</span>
          </span>
          {lastPracticed[set.id] && (
            <span>
              {language === 'pl' ? 'Ostatnio:' : 'Last:'} {lastPracticed[set.id]?.toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button size="sm" onClick={() => onStudySet(set.id)} disabled={set.cardCount === 0} className="flex-1 sm:flex-none">
          {t('flashcards.study')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onStatsSet(set.id)} className="flex-1 sm:flex-none">
          {language === 'pl' ? 'Statystyki' : 'Stats'}
        </Button>
      </div>
    </div>
  );
`;

code = code.replace(
  /const renderSetCard = \(set: FlashcardSet\) => \(/,
  listRowRender + '\n  const renderSetCard = (set: FlashcardSet) => ('
);

const lessonSetsBlockRegex = /\{lessonSets\.length > 0 && \(\s*<div className="mt-8 space-y-4">\s*<h2 className="text-xl font-bold flex items-center gap-2">\s*📚 \{language === 'pl' \? 'Słownictwo z lekcji' : 'Lesson Vocabulary'\}\s*<\/h2>\s*<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">([\s\S]*?)<\/div>\s*<\/div>\s*\)\}/;

const newLessonSetsBlock = `{lessonSets.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 pb-2 border-b border-white/10">
            📚 {language === 'pl' ? 'Słownictwo z lekcji (przypisane automatycznie)' : 'Lesson Vocabulary (Auto-assigned)'}
          </h2>
          <div className="flex flex-col gap-3">
            {lessonSets.map(set => renderSetRow(set, 'lesson'))}
          </div>
        </div>
      )}`;

code = code.replace(lessonSetsBlockRegex, newLessonSetsBlock);

const teacherSetsBlockRegex = /\{teacherSets\.length > 0 && \(\s*<div className="mt-8 space-y-4">\s*<h2 className="text-xl font-bold flex items-center gap-2">\s*👨‍🏫 \{language === 'pl' \? 'Słowa przypisane przez nauczyciela' : 'Words assigned by Teacher'\}\s*<\/h2>\s*<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">\s*\{teacherSets\.map\(renderSetCard\)\}\s*<\/div>\s*<\/div>\s*\)\}/;

const newTeacherSetsBlock = `{teacherSets.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 pb-2 border-b border-white/10">
            👨‍🏫 {language === 'pl' ? 'Zdania i słownictwo przypisane przez nauczyciela' : 'Sentences & Words assigned by Teacher'}
          </h2>
          <div className="flex flex-col gap-3">
            {teacherSets.map(set => renderSetRow(set, 'teacher'))}
          </div>
        </div>
      )}`;

code = code.replace(teacherSetsBlockRegex, newTeacherSetsBlock);

fs.writeFileSync('components/flashcards/FlashcardSetsScreen.tsx', code);
console.log("Patched flashcard sets screen");
