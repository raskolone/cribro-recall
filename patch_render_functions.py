import re

with open('components/flashcards/FlashcardSetsScreen.tsx', 'r') as f:
    content = f.read()

# I will just write the new functions and replace the old ones.

new_functions = """
  const renderLessonSet = (set: FlashcardSet, index: number, view: 'list' | 'grid') => {
    const cleanTitle = getSetCleanTitle(set);
    const lessonNum = set.lessonNumber || (lessonSets.length - index);
    const lessonDate = formatDisplayDate(set.lessonDate || set.createdAt);
    const isNew = isNewSet(set);

    const cardClass = isNew 
      ? 'bg-amber-500/10 border-2 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)] animate-pulse-slow' 
      : (view === 'grid' ? 'hover:border-amber-500/50' : 'bg-base-200/50 border border-white/5 hover:border-amber-500/30');

    if (view === 'grid') {
      return (
        <Card key={set.id} className={`flex flex-col h-full transition-all duration-300 group relative overflow-hidden ${cardClass}`}>
          {isNew && (
             <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-black font-extrabold text-[10px] uppercase rounded-bl-lg z-10 shadow-md">
               {language === 'pl' ? 'Nowe słownictwo' : 'New vocabulary'}
             </div>
          )}
          <div className="flex-1 mt-2">
            <h3 
              className="text-xl font-bold hover:text-amber-400 transition-colors cursor-pointer hover:underline line-clamp-2 mb-2" 
              onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }}
            >
              {cleanTitle}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-content-muted">
              <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                {language === 'pl' ? `Lekcja #${lessonNum}` : `Lesson #${lessonNum}`}
              </span>
              <span className="bg-base-300 px-2 py-0.5 rounded font-mono text-content">
                {set.cardCount} {t('flashcards.cards')}
              </span>
            </div>
            
            <div className="space-y-1.5 mb-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-content-muted">{language === 'pl' ? 'Opanowanie' : 'Mastery'}</span>
                <span className={(setMastery[set.id] || 0) >= 80 ? 'text-green-400 font-bold' : 'text-primary font-bold'}>{Number.isNaN(Number(setMastery[set.id])) ? 0 : (setMastery[set.id] || 0)}%</span>
              </div>
              <div className="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${(setMastery[set.id] || 0) >= 80 ? 'bg-green-400' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, Math.max(0, setMastery[set.id] || 0))}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-base-300 z-10">
            <Button className="flex-1" onClick={() => { markSetAsChecked(set.id); onStudySet(set.id); }} disabled={set.cardCount === 0}>
              🎴 {t('flashcards.study')}
            </Button>
            {onNavigate && (
              <Button variant="secondary" className="flex-[1_1_auto] border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20" onClick={() => { markSetAsChecked(set.id); onNavigate('ai-generator', { setId: set.id }); }}>
                ✨ {language === 'pl' ? 'Ćwicz' : 'Practice'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3">
              <span className="text-xl">👀</span>
            </Button>
            <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); onStatsSet(set.id); }} className="px-3">
              📊
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <div key={set.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-xl transition-all duration-300 gap-4 relative overflow-hidden ${cardClass}`}>
        {isNew && (
           <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-black font-extrabold text-[10px] uppercase rounded-bl-lg z-10 shadow-md">
             {language === 'pl' ? 'Nowe słownictwo' : 'New vocabulary'}
           </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 
              className="text-lg font-bold hover:text-amber-400 transition-colors cursor-pointer hover:underline truncate" 
              onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }}
            >
              {cleanTitle}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-content-muted mt-2">
            <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-md border border-amber-500/30">
              {language === 'pl' ? `Lekcja #${lessonNum}` : `Lesson #${lessonNum}`}
            </span>
            {lessonDate && (
              <span className="font-mono text-gray-300">
                {language === 'pl' ? `Data lekcji: ${lessonDate}` : `Date: ${lessonDate}`}
              </span>
            )}
            <span className="inline-flex items-center bg-base-300 px-2 py-0.5 rounded-md text-content font-mono">
              {set.cardCount} {t('flashcards.cards')}
            </span>
            <span className="flex items-center gap-1 font-mono">
              {language === 'pl' ? 'Opanowanie:' : 'Mastery:'} 
              <span className={(setMastery[set.id] || 0) >= 80 ? 'text-green-400 font-bold' : 'text-primary font-bold'}>{Number.isNaN(Number(setMastery[set.id])) ? 0 : (setMastery[set.id] || 0)}%</span>
            </span>
            {lastPracticed[set.id] && (
              <span className="font-mono">
                {language === 'pl' ? 'Ostatnio: ' : 'Last: '} {lastPracticed[set.id]?.toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto z-10">
          <Button 
            className="flex-1 sm:flex-none" 
            onClick={() => { markSetAsChecked(set.id); onStudySet(set.id); }}
            disabled={set.cardCount === 0}
          >
            🎴 {t('flashcards.study')}
          </Button>
          {onNavigate && (
            <Button 
              variant="secondary" 
              className="flex-1 sm:flex-none border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20" 
              onClick={() => { markSetAsChecked(set.id); onNavigate('ai-generator', { setId: set.id }); }}
            >
              ✨ {language === 'pl' ? 'Ćwicz w zdaniach' : 'Practice'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3" title="Podgląd">
            👀
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => { markSetAsChecked(set.id); onStatsSet(set.id); }} 
            className="flex-1 sm:flex-none px-3"
            title="Statystyki"
          >
            📊
          </Button>
        </div>
      </div>
    );
  };

  const renderOtherSet = (set: FlashcardSet, view: 'list' | 'grid') => {
    const cleanTitle = getSetCleanTitle(set);
    const createdDate = formatDisplayDate(set.createdAt);
    const isNew = isNewSet(set);

    const cardClass = isNew 
      ? 'bg-emerald-500/10 border-2 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.25)] animate-pulse-slow' 
      : (view === 'grid' ? 'hover:border-primary/50' : 'bg-base-200/50 border border-white/5 hover:border-primary/30');

    if (view === 'grid') {
      return (
        <Card key={set.id} className={`flex flex-col h-full transition-all duration-300 group relative overflow-hidden ${cardClass}`}>
          {isNew && (
             <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black font-extrabold text-[10px] uppercase rounded-bl-lg z-10 shadow-md">
               {language === 'pl' ? 'Nowy zestaw' : 'New set'}
             </div>
          )}
          <div className="flex-1 mt-2">
            <div className="flex justify-between items-start mb-2 gap-2">
              <h3 
                className="text-xl font-bold hover:text-primary transition-colors cursor-pointer hover:underline line-clamp-2" 
                onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }}
              >
                {cleanTitle}
              </h3>
            </div>
            {set.description && <p className="text-content-muted text-sm mb-4 line-clamp-2">{set.description}</p>}
            <div className="flex flex-wrap items-center gap-2.5 mb-6 text-xs text-content-muted">
              {createdDate && (
                <div className="font-mono bg-base-300/80 px-2.5 py-1 rounded-md text-gray-300">
                  {language === 'pl' ? `Utworzono: ${createdDate}` : `Created: ${createdDate}`}
                </div>
              )}
              <div className="inline-block bg-base-300 text-content px-2.5 py-1 rounded-md text-xs font-mono">
                {set.cardCount} {t('flashcards.cards')}
              </div>
            </div>
            <div className="space-y-1.5 mb-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-content-muted">{language === 'pl' ? 'Opanowanie' : 'Mastery'}</span>
                <span className={(setMastery[set.id] || 0) >= 80 ? 'text-green-400 font-bold' : 'text-primary font-bold'}>{Number.isNaN(Number(setMastery[set.id])) ? 0 : (setMastery[set.id] || 0)}%</span>
              </div>
              <div className="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${(setMastery[set.id] || 0) >= 80 ? 'bg-green-400' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, Math.max(0, setMastery[set.id] || 0))}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-base-300 z-10">
            <Button className="flex-[2_1_auto]" onClick={() => { markSetAsChecked(set.id); onStudySet(set.id); }} disabled={set.cardCount === 0}>
              🎴 {t('flashcards.study')}
            </Button>
            <Button variant="secondary" className="flex-[1_1_auto]" onClick={() => { markSetAsChecked(set.id); onEditSet(set.id); }}>
              {language === 'pl' ? 'Edytuj' : 'Edit'}
            </Button>
            <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3">
              👀
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <div key={set.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-xl transition-all duration-300 gap-4 relative overflow-hidden ${cardClass}`}>
        {isNew && (
           <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black font-extrabold text-[10px] uppercase rounded-bl-lg z-10 shadow-md">
             {language === 'pl' ? 'Nowy zestaw' : 'New set'}
           </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 
              className="text-lg font-bold hover:text-primary transition-colors cursor-pointer hover:underline truncate" 
              onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }}
            >
              {cleanTitle}
              {set.isDraft && <span className="ml-2 text-[10px] uppercase bg-gray-500 text-white px-2 py-0.5 rounded-full">DRAFT</span>}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-content-muted mt-2">
            {createdDate && (
              <span className="font-mono text-gray-300">
                {language === 'pl' ? `Utworzono: ${createdDate}` : `Created: ${createdDate}`}
              </span>
            )}
            <span className="inline-flex items-center bg-base-300 px-2 py-0.5 rounded-md text-content font-mono">
              {set.cardCount} {t('flashcards.cards')}
            </span>
            <span className="flex items-center gap-1 font-mono">
              {language === 'pl' ? 'Opanowanie:' : 'Mastery:'} 
              <span className={(setMastery[set.id] || 0) >= 80 ? 'text-green-400 font-bold' : 'text-primary font-bold'}>{Number.isNaN(Number(setMastery[set.id])) ? 0 : (setMastery[set.id] || 0)}%</span>
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto z-10">
          <Button 
            className="flex-1 sm:flex-none" 
            onClick={() => { markSetAsChecked(set.id); onStudySet(set.id); }}
            disabled={set.cardCount === 0}
          >
            🎴 {t('flashcards.study')}
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 sm:flex-none" 
            onClick={() => { markSetAsChecked(set.id); onEditSet(set.id); }}
          >
            {language === 'pl' ? 'Edytuj' : 'Edit'}
          </Button>
          <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3">
            👀
          </Button>
        </div>
      </div>
    );
  };
"""

pattern = r'const renderLessonSetRow = \(set: FlashcardSet, index: number\) => \{.*?\};\s*const renderOtherSetCard = \(set: FlashcardSet\) => \{.*?\};\s*return \('

if re.search(pattern, content, flags=re.DOTALL):
    content = re.sub(pattern, new_functions + '\n  return (', content, flags=re.DOTALL)
else:
    print("Could not find render functions block to replace.")

with open('components/flashcards/FlashcardSetsScreen.tsx', 'w') as f:
    f.write(content)
