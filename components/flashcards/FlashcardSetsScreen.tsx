import React, { useState, useMemo } from 'react';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { FlashcardSet } from '../../types';

interface FlashcardSetsScreenProps {
  onStudySet: (setId: string) => void;
  onEditSet: (setId: string) => void;
  onStatsSet: (setId: string) => void;
  onPresentSet?: (setId: string) => void;
}

const FlashcardSetsScreen: React.FC<FlashcardSetsScreenProps> = ({ onStudySet, onEditSet, onStatsSet, onPresentSet }) => {
  const { sets, createSet, deleteSet, sessions } = useFlashcards();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSetToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateNewSet = async () => {
    setIsCreating(true);
    try {
      const setId = await createSet({
        title: language === 'pl' ? 'Nowy zestaw' : 'New Set',
        description: '',
        isPublic: false
      });
      onEditSet(setId);
    } catch (error) {
      console.error('Failed to create set', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Calculate global stats
  const totalCards = useMemo(() => sets.reduce((acc, set) => acc + set.cardCount, 0), [sets]);
  
  // Calculate mastery per set based on sessions
  const setMastery = useMemo(() => {
    const mastery: Record<string, number> = {};
    sets.forEach(set => {
      const setSessions = sessions.filter(s => s.setId === set.id);
      if (setSessions.length === 0) {
        mastery[set.id] = 0;
      } else {
        // Average score of last 3 sessions or all if less than 3
        const recentSessions = setSessions.sort((a, b) => b.completedAt?.toMillis() - a.completedAt?.toMillis()).slice(0, 3);
        const avgScore = recentSessions.reduce((acc, s) => acc + s.scorePercent, 0) / recentSessions.length;
        mastery[set.id] = Math.round(avgScore);
      }
    });
    return mastery;
  }, [sets, sessions]);

  // Calculate last practiced per set
  const lastPracticed = useMemo(() => {
    const last: Record<string, Date | null> = {};
    sets.forEach(set => {
      const setSessions = sessions.filter(s => s.setId === set.id);
      if (setSessions.length === 0) {
        last[set.id] = null;
      } else {
        const mostRecent = setSessions.sort((a, b) => b.completedAt?.toMillis() - a.completedAt?.toMillis())[0];
        last[set.id] = mostRecent.completedAt?.toDate() || null;
      }
    });
    return last;
  }, [sets, sessions]);

  const isRecent = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const diffDays = Math.ceil(Math.abs(Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  const mySets = sets.filter(s => !s.assignedByTeacher && !s.isLessonVocabulary);
  const teacherSets = sets.filter(s => s.assignedByTeacher && !s.isLessonVocabulary);
  const lessonSets = sets.filter(s => s.isLessonVocabulary);

  const renderSetCard = (set: FlashcardSet) => (
    <Card key={set.id} className="flex flex-col h-full hover:border-primary/50 transition-colors group relative overflow-hidden">
      {isRecent(set.createdAt) && (set.assignedByTeacher || set.isLessonVocabulary) && (
         <div className="absolute top-0 right-0 px-2 py-1 bg-secondary text-secondary-content text-[10px] font-bold uppercase rounded-bl-lg z-10 animate-pulse">
           {language === 'pl' ? 'Nowe' : 'New'}
         </div>
      )}
      <div className="flex-1 mt-2">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{set.title}</h3>
          {(set.isPublic || set.assignedByTeacher) && (
            <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold ${set.assignedByTeacher ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
              {set.assignedByTeacher ? (language === 'pl' ? 'Nauczyciel' : 'Teacher') : (language === 'pl' ? 'Pub' : 'Pub')}
            </span>
          )}
        </div>
        
        {set.description && <p className="text-content-muted text-sm mb-4 line-clamp-2">{set.description}</p>}
        
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-block bg-base-300 text-content px-3 py-1 rounded-full text-xs font-mono">
            {set.cardCount} {t('flashcards.cards')}
          </div>
          {lastPracticed[set.id] && (
            <div className="text-xs text-content-muted">
              {language === 'pl' ? 'Ostatnio: ' : 'Last: '} 
              {lastPracticed[set.id]?.toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Mastery Progress */}
        <div className="space-y-1.5 mb-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-content-muted">{language === 'pl' ? 'Opanowanie' : 'Mastery'}</span>
            <span className={setMastery[set.id] >= 80 ? 'text-green-400' : 'text-primary'}>{setMastery[set.id]}%</span>
          </div>
          <div className="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${setMastery[set.id] >= 80 ? 'bg-green-400' : 'bg-primary'}`}
              style={{ width: `${setMastery[set.id]}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-base-300">
        <Button 
          className="flex-[2_1_auto]" 
          onClick={() => onStudySet(set.id)}
          disabled={set.cardCount === 0}
        >
          {t('flashcards.study')}
        </Button>
        <Button 
          variant="secondary" 
          className="flex-[1_1_auto]"
          onClick={() => onEditSet(set.id)}
        >
          {t('flashcards.edit')}
        </Button>
        <Button 
          variant="secondary" 
          className="flex-[1_1_auto]"
          onClick={() => onStatsSet(set.id)}
        >
          {language === 'pl' ? 'Opis' : 'Stats'}
        </Button>
        {user?.role === 'admin' && onPresentSet && (
          <Button 
            variant="secondary"
            className="flex-[1_1_auto] shadow-[0_0_15px_rgba(201,168,108,0.2)] bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border-orange-500/30"
            onClick={() => onPresentSet(set.id)}
            disabled={set.cardCount === 0}
          >
            ▶ {language === 'pl' ? 'Prezentuj' : 'Present'}
          </Button>
        )}
        <Button 
          variant="danger" 
          className="flex-[0_0_auto] px-3"
          onClick={() => setSetToDelete(set.id)}
        >
          🗑
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('flashcards.title')}</h1>
        <Button onClick={handleCreateNewSet} isLoading={isCreating} className="shadow-lg shadow-primary/20">
          + {language === 'pl' ? 'Stwórz nowy zestaw' : 'Create new set'}
        </Button>
      </div>

      {/* Global Stats Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-base-200 to-base-300 border-base-300">
          <div className="text-content-muted text-sm font-medium uppercase tracking-wider mb-2">
            {language === 'pl' ? 'Łączna liczba słów' : 'Total Words'}
          </div>
          <div className="text-4xl font-black text-primary">{totalCards}</div>
        </Card>
        <Card className="bg-gradient-to-br from-base-200 to-base-300 border-base-300">
          <div className="text-content-muted text-sm font-medium uppercase tracking-wider mb-2">
            {language === 'pl' ? 'Listy' : 'Lists'}
          </div>
          <div className="text-4xl font-black">{sets.length}</div>
        </Card>
        <Card className="bg-gradient-to-br from-base-200 to-base-300 border-base-300">
          <div className="text-content-muted text-sm font-medium uppercase tracking-wider mb-2">
            {language === 'pl' ? 'Średnie opanowanie' : 'Avg Mastery'}
          </div>
          <div className="text-4xl font-black text-green-400">
            {sets.length > 0 ? Math.round((Object.values(setMastery) as number[]).reduce((a: number, b: number) => a + b, 0) / sets.length) : 0}%
          </div>
        </Card>
      </div>

      {/* Lesson Sets */}
      {lessonSets.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            📚 {language === 'pl' ? 'Słownictwo z lekcji' : 'Lesson Vocabulary'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessonSets.map(set => (
              <Card key={set.id} className="flex flex-col h-full hover:border-primary/50 transition-colors group relative overflow-hidden">
                {isRecent(set.createdAt) && (
                   <div className="absolute top-0 right-0 px-2 py-1 bg-secondary text-secondary-content text-[10px] font-bold uppercase rounded-bl-lg z-10 animate-pulse">
                     {language === 'pl' ? 'Nowe' : 'New'}
                   </div>
                )}
                <div className="flex-1 mt-2">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{set.title}</h3>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold bg-amber-500/10 text-amber-500">
                      {language === 'pl' ? 'Lekcja' : 'Lesson'}
                    </span>
                  </div>
                  
                  {set.lessonDate && (
                    <div className="text-xs text-content-muted mb-1 font-mono">
                      {language === 'pl' ? 'Data lekcji: ' : 'Lesson Date: '}{set.lessonDate}
                    </div>
                  )}
                  {set.lessonTopic && (
                    <div className="text-sm font-medium mb-3 italic text-content-muted line-clamp-2">
                      {language === 'pl' ? 'Temat: ' : 'Topic: '}{set.lessonTopic}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-6 mt-4">
                    <div className="inline-block bg-base-300 text-content px-3 py-1 rounded-full text-xs font-mono">
                      {set.cardCount} {t('flashcards.cards')}
                    </div>
                    {lastPracticed[set.id] && (
                      <div className="text-xs text-content-muted">
                        {language === 'pl' ? 'Ostatnio: ' : 'Last: '} 
                        {lastPracticed[set.id]?.toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Mastery Progress */}
                  <div className="space-y-1.5 mb-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-content-muted">{language === 'pl' ? 'Opanowanie' : 'Mastery'}</span>
                      <span className={setMastery[set.id] >= 80 ? 'text-green-400' : 'text-primary'}>{setMastery[set.id]}%</span>
                    </div>
                    <div className="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${setMastery[set.id] >= 80 ? 'bg-green-400' : 'bg-primary'}`}
                        style={{ width: `${setMastery[set.id]}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-base-300">
                  <Button 
                    className="flex-[2_1_auto]" 
                    onClick={() => onStudySet(set.id)}
                    disabled={set.cardCount === 0}
                  >
                    {t('flashcards.study')}
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-[1_1_auto]"
                    onClick={() => onStatsSet(set.id)}
                  >
                    {language === 'pl' ? 'Statystyki' : 'Stats'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Teacher Assigned Sets */}
      {teacherSets.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            👨‍🏫 {language === 'pl' ? 'Słowa przypisane przez nauczyciela' : 'Words assigned by Teacher'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teacherSets.map(renderSetCard)}
          </div>
        </div>
      )}

      {/* My Word Sets Grid */}
      <div className="mt-8 space-y-4">
        {(teacherSets.length > 0 || lessonSets.length > 0) && (
          <h2 className="text-xl font-bold flex items-center gap-2">
            👤 {language === 'pl' ? 'Moja lista słów' : 'My Word Lists'}
          </h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mySets.map(renderSetCard)}
          
          {sets.length === 0 && (
            <div className="col-span-full text-center py-16 text-content-muted border-2 border-dashed border-base-300 rounded-2xl bg-base-200/50">
              <div className="text-4xl mb-4">🗂️</div>
              <h3 className="text-xl font-bold mb-2">{t('flashcards.empty')}</h3>
              <p className="mb-6 max-w-md mx-auto">
                {language === 'pl' 
                  ? 'Stwórz swoją pierwszą listę słów, dodaj pojęcia i definicje, a następnie rozpocznij naukę w jednym z 4 trybów.' 
                  : 'Create your first word list, add terms and definitions, then start learning in one of 4 modes.'}
              </p>
              <Button onClick={handleCreateNewSet} isLoading={isCreating}>
                + {language === 'pl' ? 'Stwórz nowy zestaw' : 'Create new set'}
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {setToDelete && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">{language === 'pl' ? 'Potwierdzenie usunięcia' : 'Confirm Deletion'}</h3>
            <p className="mb-6 opacity-80">
              {language === 'pl' 
                ? 'Czy na pewno chcesz usunąć ten zestaw? Tej akcji nie można cofnąć.' 
                : 'Are you sure you want to delete this set? This action cannot be undone.'}
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setSetToDelete(null)} variant="secondary">
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button 
                onClick={() => {
                  deleteSet(setToDelete);
                  setSetToDelete(null);
                }} 
                variant="danger"
              >
                {language === 'pl' ? 'Usuń zestaw' : 'Delete Set'}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default FlashcardSetsScreen;
