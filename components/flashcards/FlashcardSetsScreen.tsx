import React, { useState, useMemo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import TTSButtons from './TTSButtons';
import { FlashcardSet } from '../../types';
import { cleanVocabularyTopic } from '../../utils/vocabulary';

interface FlashcardSetsScreenProps {
  onStudySet: (setId: string) => void;
  onEditSet: (setId: string) => void;
  onStatsSet: (setId: string) => void;
  onPresentSet?: (setId: string) => void;
  onNavigate?: (view: string, extra?: any) => void;
}

const FlashcardSetsScreen: React.FC<FlashcardSetsScreenProps> = ({ onStudySet, onEditSet, onStatsSet, onPresentSet, onNavigate }) => {
  const { sets, createSet, deleteSet, sessions } = useFlashcards();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [previewSetId, setPreviewSetId] = useState<string | null>(null);
  const [previewCards, setPreviewCards] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const { getFlashcards } = useFlashcards();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSetToDelete(null);
        setPreviewSetId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePreviewSet = async (setId: string) => {
    try {
      const local = JSON.parse(localStorage.getItem('checked_sets') || '[]');
      if (!local.includes(setId)) {
        localStorage.setItem('checked_sets', JSON.stringify([...local, setId]));
      }
    } catch(e) {}
    
    if (user?.hasNewVocabulary && user?.id) {
       import('firebase/firestore').then(({ doc, updateDoc }) => {
         import('../../firebase').then(m => updateDoc(doc(m.db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error));
       });
    }

    setPreviewSetId(setId);
    setIsLoadingPreview(true);
    try {
      const cards = await getFlashcards(setId);
      setPreviewCards(cards);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && containerRef.current.children.length > 0) {
      gsap.fromTo(gsap.utils.toArray(containerRef.current.children), 
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [sets]);

  const handleCreateNewSet = async () => {
    setIsCreating(true);
    try {
      const setId = await createSet({
        title: language === 'pl' ? 'Nowy zestaw' : 'New Set',
        description: '',
        isPublic: false,
        isDraft: true
      });
      onEditSet(setId);
    } catch (error) {
      console.error('Failed to create set', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Helper to safely get timestamp milliseconds
  const getSafeMillis = (val: any): number => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
      const parsed = new Date(val).getTime();
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const getSafeDate = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'string') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
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
        const recentSessions = [...setSessions].sort((a, b) => getSafeMillis(b.completedAt) - getSafeMillis(a.completedAt)).slice(0, 3);
        const scores = recentSessions.map(s => (s.scorePercent !== undefined && s.scorePercent !== null && !isNaN(Number(s.scorePercent)) ? Number(s.scorePercent) : 0));
        const avgScore = scores.reduce((acc, val) => acc + val, 0) / (scores.length || 1);
        mastery[set.id] = isNaN(avgScore) ? 0 : Math.round(avgScore);
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
        const mostRecent = [...setSessions].sort((a, b) => getSafeMillis(b.completedAt) - getSafeMillis(a.completedAt))[0];
        last[set.id] = getSafeDate(mostRecent?.completedAt);
      }
    });
    return last;
  }, [sets, sessions]);

  const isNewSet = (set: FlashcardSet) => {
    if (!set) return false;
    
    let checkedSets: string[] = [];
    try {
      checkedSets = JSON.parse(localStorage.getItem('checked_sets') || '[]');
    } catch(e) {}
    if (checkedSets.includes(set.id)) return false;

    const dismissed = user?.dismissedNotifications || [];
    if (dismissed.includes(set.id)) return false;

    // If assigned by teacher or is a lesson vocabulary, and not checked, it IS new
    if (set.assignedByTeacher || set.isLessonVocabulary) {
      return true;
    }

    // Otherwise, check if created in the last 7 days
    if (set.createdAt) {
      const dateStr = set.createdAt;
      const date = typeof dateStr === 'string' ? new Date(dateStr) : (dateStr.toDate ? dateStr.toDate() : new Date());
      if (!isNaN(date.getTime())) {
        const diffDays = Math.ceil(Math.abs(Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
    }
    
    return false;
  };

  const markSetAsChecked = (setId: string) => {
    try {
      const local = JSON.parse(localStorage.getItem('checked_sets') || '[]');
      if (!local.includes(setId)) {
        localStorage.setItem('checked_sets', JSON.stringify([...local, setId]));
      }
    } catch (e) {}
  };

  const formatDisplayDate = (dateVal: any) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') return dateVal;
    if (dateVal.toDate && typeof dateVal.toDate === 'function') {
      return dateVal.toDate().toLocaleDateString();
    }
    if (dateVal.seconds) {
      return new Date(dateVal.seconds * 1000).toLocaleDateString();
    }
    return String(dateVal);
  };

  const getSetCleanTitle = (set: FlashcardSet) => {
    const raw = set.title || set.lessonTopic || '';
    const cleaned = cleanVocabularyTopic(raw);
    return cleaned || set.lessonDate || formatDisplayDate(set.createdAt) || (language === 'pl' ? 'Zestaw słówek' : 'Word Set');
  };

  const sortedSets = useMemo(() => {
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
  const otherSets = sortedSets.filter(s => !s.isLessonVocabulary && !s.isGeneral);
  const generalSets = sortedSets.filter(s => s.isGeneral);

  
  const renderLessonSet = (set: FlashcardSet, index: number, view: 'list' | 'grid') => {
    const cleanTitle = getSetCleanTitle(set);
    const lessonNum = set.lessonNumber || (lessonSets.length - index);
    const lessonDate = formatDisplayDate(set.lessonDate || set.createdAt);
    const isNew = isNewSet(set);

    const cardClass = isNew 
      ? 'bg-warn/10 border-2 border-warn/60 shadow-[0_0_20px_rgba(245,158,11,0.25)] animate-pulse-slow' 
      : (view === 'grid' ? 'hover:border-warn/50' : 'bg-base-200/50 border border-white/5 hover:border-warn/30');

    if (view === 'grid') {
      return (
        <Card key={set.id} className={`flex flex-col h-full transition-all duration-300 group relative overflow-hidden ${cardClass}`}>
          {isNew && (
             <div className="absolute top-0 right-0 px-3 py-1 bg-warn text-black font-extrabold text-[10px] uppercase rounded-bl-lg z-10 shadow-md">
               {language === 'pl' ? 'Nowe słownictwo' : 'New vocabulary'}
             </div>
          )}
          <div className="flex-1 mt-2">
            <h3 
              className="text-xl font-bold hover:text-warn transition-colors cursor-pointer hover:underline line-clamp-2 mb-2" 
              onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }}
            >
              {cleanTitle}
                {set.isDraft && <span className="ml-2 text-[10px] uppercase bg-text-faint text-white px-2 py-0.5 rounded-full">DRAFT</span>}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-content-muted">
              <span className="inline-flex items-center gap-1 font-mono font-bold text-warn bg-warn/15 px-2 py-0.5 rounded border border-warn/30">
                {language === 'pl' ? `Lekcja #${lessonNum}` : `Lesson #${lessonNum}`}
              </span>
              <span className="bg-base-300 px-2 py-0.5 rounded font-mono text-content">
                {set.cardCount} {t('flashcards.cards')}
              </span>
            </div>
            
            <div className="space-y-1.5 mb-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-content-muted">{language === 'pl' ? 'Opanowanie' : 'Mastery'}</span>
                <span className={(setMastery[set.id] || 0) >= 80 ? 'text-primary font-bold' : 'text-primary/60 font-bold'}>{Number.isNaN(Number(setMastery[set.id])) ? 0 : (setMastery[set.id] || 0)}%</span>
              </div>
              <div className="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${(setMastery[set.id] || 0) >= 80 ? 'bg-primary shadow-glow' : 'bg-primary/40'}`}
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
              <Button variant="secondary" className="flex-[1_1_auto] border-primary/30 text-primary hover:bg-primary/20" onClick={() => { markSetAsChecked(set.id); onNavigate('ai-generator', { setId: set.id }); }}>
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
           <div className="absolute top-0 right-0 px-3 py-1 bg-warn text-black font-extrabold text-[10px] uppercase rounded-bl-lg z-10 shadow-md">
             {language === 'pl' ? 'Nowe słownictwo' : 'New vocabulary'}
           </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 
              className="text-lg font-bold hover:text-warn transition-colors cursor-pointer hover:underline truncate" 
              onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }}
            >
              {cleanTitle}
                {set.isDraft && <span className="ml-2 text-[10px] uppercase bg-text-faint text-white px-2 py-0.5 rounded-full">DRAFT</span>}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-content-muted mt-2">
            <span className="inline-flex items-center gap-1 font-mono font-bold text-warn bg-warn/15 px-2.5 py-0.5 rounded-md border border-warn/30">
              {language === 'pl' ? `Lekcja #${lessonNum}` : `Lesson #${lessonNum}`}
            </span>
            {lessonDate && (
              <span className="font-mono text-content">
                {language === 'pl' ? `Data lekcji: ${lessonDate}` : `Date: ${lessonDate}`}
              </span>
            )}
            <span className="inline-flex items-center bg-base-300 px-2 py-0.5 rounded-md text-content font-mono">
              {set.cardCount} {t('flashcards.cards')}
            </span>
            <span className="flex items-center gap-1 font-mono">
              {language === 'pl' ? 'Opanowanie:' : 'Mastery:'} 
              <span className={(setMastery[set.id] || 0) >= 80 ? 'text-primary font-bold' : 'text-primary/60 font-bold'}>{Number.isNaN(Number(setMastery[set.id])) ? 0 : (setMastery[set.id] || 0)}%</span>
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
              className="flex-1 sm:flex-none border-primary/30 text-primary hover:bg-primary/20" 
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
      ? 'bg-primary/10 border-2 border-primary/60 shadow-[0_0_20px_rgba(16,185,129,0.25)] animate-pulse-slow' 
      : (view === 'grid' ? 'hover:border-primary/50' : 'bg-base-200/50 border border-white/5 hover:border-primary/30');

    if (view === 'grid') {
      return (
        <Card key={set.id} className={`flex flex-col h-full transition-all duration-300 group relative overflow-hidden ${cardClass}`}>
          {isNew && (
             <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-accent-ink font-extrabold text-[10px] uppercase rounded-bl-lg z-10 shadow-md">
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
                {set.isDraft && <span className="ml-2 text-[10px] uppercase bg-text-faint text-white px-2 py-0.5 rounded-full">DRAFT</span>}
              </h3>
            </div>
            {set.description && <p className="text-content-muted text-sm mb-4 line-clamp-2">{set.description}</p>}
            <div className="flex flex-wrap items-center gap-2.5 mb-6 text-xs text-content-muted">
              {createdDate && (
                <div className="font-mono bg-base-300/80 px-2.5 py-1 rounded-md text-content">
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
                <span className={(setMastery[set.id] || 0) >= 80 ? 'text-primary font-bold' : 'text-primary/60 font-bold'}>{Number.isNaN(Number(setMastery[set.id])) ? 0 : (setMastery[set.id] || 0)}%</span>
              </div>
              <div className="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${(setMastery[set.id] || 0) >= 80 ? 'bg-primary shadow-glow' : 'bg-primary/40'}`}
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
            <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3" title={language === 'pl' ? 'Podgląd' : 'Preview'}>
              👀
            </Button>
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setSetToDelete(set.id); }} className="px-3 border-danger/30 text-danger hover:opacity-80 hover:bg-danger/10" title={language === 'pl' ? 'Usuń zestaw' : 'Delete set'}>
              🗑️
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <div key={set.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-xl transition-all duration-300 gap-4 relative overflow-hidden ${cardClass}`}>
        {isNew && (
           <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-accent-ink font-extrabold text-[10px] uppercase rounded-bl-lg z-10 shadow-md">
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
              {set.isDraft && <span className="ml-2 text-[10px] uppercase bg-text-faint text-white px-2 py-0.5 rounded-full">DRAFT</span>}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-content-muted mt-2">
            {createdDate && (
              <span className="font-mono text-content">
                {language === 'pl' ? `Utworzono: ${createdDate}` : `Created: ${createdDate}`}
              </span>
            )}
            <span className="inline-flex items-center bg-base-300 px-2 py-0.5 rounded-md text-content font-mono">
              {set.cardCount} {t('flashcards.cards')}
            </span>
            <span className="flex items-center gap-1 font-mono">
              {language === 'pl' ? 'Opanowanie:' : 'Mastery:'} 
              <span className={(setMastery[set.id] || 0) >= 80 ? 'text-primary font-bold' : 'text-primary/60 font-bold'}>{Number.isNaN(Number(setMastery[set.id])) ? 0 : (setMastery[set.id] || 0)}%</span>
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
          <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3" title={language === 'pl' ? 'Podgląd' : 'Preview'}>
            👀
          </Button>
          <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setSetToDelete(set.id); }} className="px-3 border-danger/30 text-danger hover:opacity-80 hover:bg-danger/10" title={language === 'pl' ? 'Usuń zestaw' : 'Delete set'}>
            🗑️
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12" ref={containerRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{language === 'pl' ? 'Moje Listy Słów' : 'My Word Lists'}</h1>
        <div className="flex flex-wrap gap-3">
          
          <div className="flex bg-base-300 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-accent-ink shadow-sm' : 'text-content-muted hover:text-white'}`}
            >
              ☰
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'grid' ? 'bg-primary text-accent-ink shadow-sm' : 'text-content-muted hover:text-white'}`}
            >
              ⊞
            </button>
          </div>
          <Button onClick={handleCreateNewSet} isLoading={isCreating} className="shadow-lg shadow-primary/20">
            + {language === 'pl' ? 'Stwórz nowy zestaw' : 'Create new set'}
          </Button>
        </div>
      </div>

      {/* Lesson Vocabulary Section */}
      {lessonSets.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 pb-2 border-b border-white/10 text-warn">
            📚 {language === 'pl' ? 'Słownictwo z lekcji' : 'Lesson Vocabulary'}
          </h2>
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>
            {lessonSets.map((set, idx) => renderLessonSet(set, idx, viewMode))}
          </div>
        </div>
      )}

      {/* Remaining Vocabulary Section */}
      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 pb-2 border-b border-white/10 text-primary">
          📝 {language === 'pl' ? 'Słownictwo prywatne' : 'Private Vocabulary'}
        </h2>
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>
          {otherSets.map(set => renderOtherSet(set, viewMode))}
          
          {otherSets.length === 0 && (
            <div className="col-span-full text-center py-12 text-content-muted border border-dashed border-base-300 rounded-2xl bg-base-200/30">
              <p className="text-sm">{language === 'pl' ? 'Brak własnych zestawów słówek. Utwórz nowy zestaw powyżej!' : 'No custom word sets. Create a new set above!'}</p>
            </div>
          )}

          {sets.length === 0 && (
            <div className="col-span-full text-center py-16 text-content-muted border-2 border-dashed border-base-300 rounded-2xl bg-base-200/50">
              <div className="text-4xl mb-4">🗂️</div>
              <h3 className="text-xl font-bold mb-2">{t('flashcards.empty')}</h3>
              <p className="mb-6 max-w-md mx-auto">
                {language === 'pl' 
                  ? 'Stwórz swoją pierwszą listę słów, dodaj pojęcia i definicje, a następnie rozpocznij naukę w jednym z trybów.' 
                  : 'Create your first word list, add terms and definitions, then start learning in one of the modes.'}
              </p>
              <Button onClick={handleCreateNewSet} isLoading={isCreating}>
                + {language === 'pl' ? 'Stwórz nowy zestaw' : 'Create new set'}
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Preview Modal */}
      {previewSetId && (
        <div className="fixed inset-0 bg-ink/72 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center animate-pulse" style={{ animationDuration: '4s' }}>
            <div className="w-[80vw] max-w-3xl h-[80vh] max-h-[600px] bg-primary/10 rounded-full blur-[120px]"></div>
          </div>
          <div className="w-full max-w-3xl lg:max-w-4xl bg-base-200/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_60px_rgba(74,222,128,0.15)] max-h-[85vh] flex flex-col relative z-10 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">{language === 'pl' ? 'Podgląd słownictwa' : 'Vocabulary Preview'}</h3>
              <button onClick={() => setPreviewSetId(null)} className="text-content-muted hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2 pr-1">
              {isLoadingPreview ? (
                <div className="text-center py-8 text-content-muted">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  {language === 'pl' ? 'Ładowanie...' : 'Loading...'}
                </div>
              ) : previewCards.length === 0 ? (
                <div className="text-center py-8 text-content-muted">
                  {language === 'pl' ? 'Brak słówek w zestawie.' : 'No words in this set.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {previewCards.map((card, idx) => (
                    <div 
                      key={card.id || idx} 
                      className="bg-base-200/50 backdrop-blur-md border border-white/5 p-3.5 rounded-xl flex items-center justify-between gap-3 transition-all hover:bg-base-200/80 hover:border-primary/30 min-w-0 overflow-hidden"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex shrink-0 items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <div className="font-bold text-white text-sm md:text-base truncate" title={card.front || card.term}>
                            {card.front || card.term}
                          </div>
                          <div className="text-primary/80 font-medium text-xs md:text-sm truncate" title={card.back || card.definition}>
                            {card.back || card.definition}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center">
                        <TTSButtons text={card.front || card.term} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-base-300 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-sm text-content-muted">
                {language === 'pl' ? `Słówka: ${previewCards.length}` : `Words: ${previewCards.length}`}
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button onClick={() => setPreviewSetId(null)} variant="secondary" className="flex-1 sm:flex-none">
                  {language === 'pl' ? 'Zamknij' : 'Close'}
                </Button>
                <Button onClick={() => {
                  onStudySet(previewSetId);
                  setPreviewSetId(null);
                }} disabled={previewCards.length === 0} className="flex-1 sm:flex-none">
                  {language === 'pl' ? 'Wybierz ćwiczenie' : 'Choose exercise'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {setToDelete && (
        <div className="fixed inset-0 bg-ink/72 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                  if (setToDelete) {
                    deleteSet(setToDelete);
                  }
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
