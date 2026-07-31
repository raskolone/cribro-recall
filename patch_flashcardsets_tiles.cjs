const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardSetsScreen.tsx', 'utf8');

const target1 = `  const lessonSets = useMemo(() => sets.filter(s => s.isLessonVocabulary), [sets]);
  const otherSets = useMemo(() => sets.filter(s => !s.isLessonVocabulary), [sets]);`;

const repl1 = `  const sortedSets = useMemo(() => {
    return [...sets].sort((a, b) => {
      // Sort by date descending (newest first)
      const dateA = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt.toMillis ? a.createdAt.toMillis() : 0)) : 0;
      const dateB = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt.toMillis ? b.createdAt.toMillis() : 0)) : 0;
      
      // Group: lessons first (1), others second (2)
      const groupA = a.isLessonVocabulary ? 1 : 2;
      const groupB = b.isLessonVocabulary ? 1 : 2;
      
      if (groupA !== groupB) return groupA - groupB;
      return dateB - dateA;
    });
  }, [sets]);
  const lessonSets = sortedSets.filter(s => s.isLessonVocabulary);
  const otherSets = sortedSets.filter(s => !s.isLessonVocabulary);`;

code = code.replace(target1, repl1);

const target2 = `{lessonSets.length > 0 && (
          <div className="mb-8 space-y-3">
            {lessonSets.map((set, index) => renderLessonSetRow(set, index))}
          </div>
        )}`;

const repl2 = `{lessonSets.length > 0 && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessonSets.map(renderOtherSetCard)}
          </div>
        )}`;

code = code.replace(target2, repl2);

fs.writeFileSync('components/flashcards/FlashcardSetsScreen.tsx', code);
