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
import { areLessonSetAliases, compareLessonSetsNewestFirst, getCanonicalLessonRecordId, getLessonSetAliases } from '../../utils/lessonCanonicalKey';
import { formatDisplayDateValue } from '../../utils/displayDate';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface FlashcardSetsScreenProps {
  onStudySet: (setId: string) => void;
  onEditSet: (setId: string) => void;
  onStatsSet: (setId: string) => void;
  onPresentSet?: (setId: string) => void;
  onNavigate?: (view: string, extra?: any) => void;
  /** Osadzony w zakładce „Słownictwo” w „Moich zasobach”: bez własnego nagłówka strony. */
  embedded?: boolean;
}

const FlashcardSetsScreen: React.FC<FlashcardSetsScreenProps> = ({ onStudySet, onEditSet, onStatsSet, onPresentSet, onNavigate, embedded = false }) => {
  const { sets, createSet, deleteSet, sessions } = useFlashcards();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [previewSetId, setPreviewSetId] = useState<string | null>(null);
  const [previewCards, setPreviewCards] = useState<any[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const { getFlashcards } = useFlashcards();

  useEscapeModal(!!previewSetId, () => setPreviewSetId(null));
  useEscapeModal(!!setToDelete, () => setSetToDelete(null), 5);

  const handlePreviewSet = async (setId: string) => {
    try {
      const local: string[] = JSON.parse(localStorage.getItem('checked_sets') || '[]');
      const canonKey = getCanonicalLessonRecordId(setId);
      const aliases = canonKey ? getLessonSetAliases(canonKey, [setId]) : [setId];
      const toAdd = aliases.filter(a => !local.includes(a));
      if (toAdd.length > 0) {
        localStorage.setItem('checked_sets', JSON.stringify([...local, ...toAdd]));
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
      // Animacja wejścia jest wyłącznie kosmetyczna — jej błąd nie może wywrócić listy zestawów.
      try {
        gsap.fromTo(gsap.utils.toArray(containerRef.current.children),
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
        );
      } catch (e) {
        console.warn('GSAP animation error:', e);
      }
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
      const setSessions = sessions.filter(s => s.setId === set.id || areLessonSetAliases(s.setId, set.id));
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
      const setSessions = sessions.filter(s => s.setId === set.id || areLessonSetAliases(s.setId, set.id));
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

    const dismissed = user?.dismissedNotifications || [];
    const canonKey = getCanonicalLessonRecordId(set.id, {
      lessonRecordId: set.lessonRecordId,
      lessonTopic: set.lessonTopic || set.title,
      lessonDate: set.lessonDate,
    });
    const aliases = canonKey ? getLessonSetAliases(canonKey, [set.id]) : [set.id];

    if (aliases.some(id => checkedSets.includes(id))) return false;
    if (aliases.some(id => dismissed.includes(id))) return false;

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
      const local: string[] = JSON.parse(localStorage.getItem('checked_sets') || '[]');
      const canonKey = getCanonicalLessonRecordId(setId);
      const aliases = canonKey ? getLessonSetAliases(canonKey, [setId]) : [setId];
      const toAdd = aliases.filter(a => !local.includes(a));
      if (toAdd.length > 0) {
        localStorage.setItem('checked_sets', JSON.stringify([...local, ...toAdd]));
      }
    } catch (e) {}
  };

  const formatDisplayDate = (dateVal: any) => formatDisplayDateValue(dateVal, language === 'pl' ? 'pl-PL' : 'en-GB');

  const getSetCleanTitle = (set: FlashcardSet) => {
    const raw = set.title || set.lessonTopic || '';
    const cleaned = cleanVocabularyTopic(raw);
    return cleaned || formatDisplayDate(set.lessonDate) || formatDisplayDate(set.createdAt) || (language === 'pl' ? 'Zestaw słówek' : 'Word Set');
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
  const lessonSets = sortedSets.filter(s => s.isLessonVocabulary).sort(compareLessonSetsNewestFirst);
  const otherSets = sortedSets.filter(s => !s.isLessonVocabulary && !s.isGeneral);
  const generalSets = sortedSets.filter(s => s.isGeneral);

  
  const masteryOf = (id: string) => {
    const v = Number(setMastery[id]);
    return Number.isNaN(v) ? 0 : Math.min(100, Math.max(0, v));
  };
  const formatShortDate = (dateVal: any) => formatDisplayDateValue(dateVal, language === 'pl' ? 'pl-PL' : 'en-GB', 'short');
  const openPreview = (id: string) => { markSetAsChecked(id); handlePreviewSet(id); };
  const cardsLabel = (set: FlashcardSet) => `${set.cardCount} ${t('flashcards.cards')}`;
  const labels = {
    practice: language === 'pl' ? 'Ćwicz w zdaniach AI' : 'Practice with AI',
    preview: language === 'pl' ? 'Podgląd' : 'Preview',
    stats: language === 'pl' ? 'Statystyki' : 'Stats',
    edit: language === 'pl' ? 'Edytuj' : 'Edit',
    remove: language === 'pl' ? 'Usuń zestaw' : 'Delete set',
    mastery: language === 'pl' ? 'Opanowanie' : 'Mastery',
    last: language === 'pl' ? 'Ostatnio' : 'Last',
  };

  const studyButton = (set: FlashcardSet) => (
    <Button
      className="flex-1 min-w-[5.5rem] h-10 !px-3 text-sm whitespace-nowrap pointer-coarse:h-11"
      onClick={() => { markSetAsChecked(set.id); onStudySet(set.id); }}
      disabled={set.cardCount === 0}
    >
      🎴 {t('flashcards.study')}
    </Button>
  );

  const masteryBar = (id: string) => {
    const value = masteryOf(id);
    return (
      <div className="flex items-center gap-2" aria-label={`${labels.mastery} ${value}%`}>
        <div className="flex-1 bg-base-300 h-1.5 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-500 ${value >= 80 ? 'bg-primary' : 'bg-primary/40'}`} style={{ width: `${value}%` }} />
        </div>
        <span className={`shrink-0 font-mono text-[12px] ${value >= 80 ? 'text-primary font-bold' : 'text-content-muted'}`}>{value}%</span>
      </div>
    );
  };

  const newBadge = (text: string, tone: 'warn' | 'primary') => (
    <span className={`inline-flex w-fit shrink-0 items-center rounded-md px-2 py-0.5 text-[12px] font-extrabold uppercase whitespace-nowrap ${tone === 'warn' ? 'bg-warn text-black' : 'bg-primary text-accent-ink'}`}>{text}</span>
  );

  /** Wiersz akcji: Ucz się + równe ikony 40×40 (nigdy poza kartą, etykiety bez łamania). */
  const iconAction = (label: string, onClick: (e: React.MouseEvent) => void, content: React.ReactNode, opts: { disabled?: boolean; danger?: boolean; accent?: boolean } = {}) => (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={opts.disabled}
      title={label}
      aria-label={label}
      className={`!px-0 h-10 w-10 shrink-0 text-base leading-none pointer-coarse:h-11 pointer-coarse:w-11 ${opts.danger ? 'border-danger/30 text-danger hover:opacity-80 hover:bg-danger/10' : ''} ${opts.accent ? 'border-primary/30 text-primary' : ''}`}
    >
      <span aria-hidden="true">{content}</span>
    </Button>
  );

  const renderLessonSet = (set: FlashcardSet, index: number, view: 'list' | 'grid') => {
    const cleanTitle = getSetCleanTitle(set);
    /* Numer OD NAJSTARSZEJ lekcji wyliczony stabilnie z chronologii lekcji
       (services/vocabularyService.ts i FlashcardContext.tsx).
       Dla zestawu bez ustalonego numeru ukrywamy etykietę numeru (VOCAB-DUP-2). */
    const lessonNum = set.lessonNumber;
    const lessonDate = formatShortDate(set.lessonDate || set.createdAt);
    const isNew = isNewSet(set);
    const last = lastPracticed[set.id];
    const lastText = last ? `${labels.last}: ${last.toLocaleDateString()}` : '';
    const newText = language === 'pl' ? 'Nowe słownictwo' : 'New vocabulary';

    const cardClass = isNew
      ? 'bg-warn/10 border-2 border-warn/60 shadow-[0_0_20px_rgba(224,168,58,0.25)] animate-pulse-slow'
      : (view === 'grid' ? 'hover:border-warn/50' : 'bg-base-200/50 border border-line-soft hover:border-warn/30');

    const actions = (withLabels: boolean) => (
      <>
        {studyButton(set)}
        {onNavigate && (withLabels
          ? (
            <Button variant="secondary" className="h-10 !px-4 whitespace-nowrap border-primary/30 text-primary hover:bg-primary/20" onClick={() => { markSetAsChecked(set.id); onNavigate('ai-generator', { setId: set.id }); }}>
              ✨ {language === 'pl' ? 'Ćwicz w zdaniach' : 'Practice'}
            </Button>
          )
          : iconAction(labels.practice, () => { markSetAsChecked(set.id); onNavigate('ai-generator', { setId: set.id }); }, '✨', { accent: true }))}
        {iconAction(labels.preview, () => openPreview(set.id), '👀', { disabled: set.cardCount === 0 })}
        {iconAction(labels.stats, () => { markSetAsChecked(set.id); onStatsSet(set.id); }, '📊')}
      </>
    );

    if (view === 'grid') {
      const meta = [lessonNum ? (language === 'pl' ? `Lekcja #${lessonNum}` : `Lesson #${lessonNum}`) : '', lessonDate, cardsLabel(set)].filter(Boolean).join(' · ');
      return (
        <Card key={set.id} data-testid="vocab-set-card" className={`!p-3 flex flex-col gap-2.5 h-full min-w-0 group ${cardClass}`}>
          {isNew && newBadge(newText, 'warn')}
          <h3
            className="text-[15px] font-bold leading-snug line-clamp-2 break-words [overflow-wrap:anywhere] hover:text-warn transition-colors cursor-pointer hover:underline"
            title={cleanTitle}
            onClick={() => openPreview(set.id)}
          >
            {cleanTitle}
            {set.isDraft && <span className="ml-2 text-[12px] uppercase bg-text-faint text-white px-2 py-0.5 rounded-full">DRAFT</span>}
          </h3>
          <p className="truncate text-xs text-content-muted" title={meta}>{meta}</p>
          {masteryBar(set.id)}
          {lastText && <p className="truncate text-[12px] text-content-muted" title={lastText}>{lastText}</p>}
          <div className="mt-auto pt-3 border-t border-line flex items-center gap-1.5">{actions(false)}</div>
        </Card>
      );
    }

    return (
      <div key={set.id} data-testid="vocab-set-card" className={`flex flex-col @lg:flex-row @lg:items-center gap-3 p-4 rounded-xl min-w-0 transition-all duration-300 ${cardClass}`}>
        <div className="min-w-0 flex-1">
          <h3
            className="min-w-0 text-base font-bold hover:text-warn transition-colors cursor-pointer hover:underline truncate"
            title={cleanTitle}
            onClick={() => openPreview(set.id)}
          >
            {cleanTitle}
            {set.isDraft && <span className="ml-2 text-[12px] uppercase bg-text-faint text-white px-2 py-0.5 rounded-full">DRAFT</span>}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-muted mt-1.5">
            {isNew && newBadge(newText, 'warn')}
            {lessonNum ? (
              <span className="inline-flex items-center font-mono font-bold text-warn bg-warn/15 px-2 py-0.5 rounded-md border border-warn/30 whitespace-nowrap">
                {language === 'pl' ? `Lekcja #${lessonNum}` : `Lesson #${lessonNum}`}
              </span>
            ) : null}
            {lessonDate && <span className="font-mono text-content whitespace-nowrap">{lessonDate}</span>}
            <span className="inline-flex items-center bg-base-300 px-2 py-0.5 rounded-md text-content font-mono whitespace-nowrap">{cardsLabel(set)}</span>
            <span className={`font-mono whitespace-nowrap ${masteryOf(set.id) >= 80 ? 'text-primary font-bold' : ''}`}>{labels.mastery} {masteryOf(set.id)}%</span>
            {lastText && <span className="font-mono whitespace-nowrap">{lastText}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 @lg:ml-auto shrink-0 max-w-full">{actions(!embedded)}</div>
      </div>
    );
  };

  const renderOtherSet = (set: FlashcardSet, view: 'list' | 'grid') => {
    const cleanTitle = getSetCleanTitle(set);
    const createdDate = formatShortDate(set.createdAt);
    const isNew = isNewSet(set);
    const newText = language === 'pl' ? 'Nowy zestaw' : 'New set';

    const cardClass = isNew
      ? 'bg-primary/10 border-2 border-primary/60 shadow-[0_0_20px_rgba(114,240,180,0.25)] animate-pulse-slow'
      : (view === 'grid' ? 'hover:border-primary/50' : 'bg-base-200/50 border border-line-soft hover:border-primary/30');

    const actions = (withLabels: boolean) => (
      <>
        {studyButton(set)}
        {withLabels
          ? (
            <Button variant="secondary" className="h-10 !px-4 whitespace-nowrap" onClick={() => { markSetAsChecked(set.id); onEditSet(set.id); }}>
              {labels.edit}
            </Button>
          )
          : iconAction(labels.edit, () => { markSetAsChecked(set.id); onEditSet(set.id); }, '✏️')}
        {iconAction(labels.preview, () => openPreview(set.id), '👀', { disabled: set.cardCount === 0 })}
        {iconAction(labels.remove, (e) => { e.stopPropagation(); setSetToDelete(set.id); }, '🗑️', { danger: true })}
      </>
    );

    if (view === 'grid') {
      const meta = [createdDate, cardsLabel(set)].filter(Boolean).join(' · ');
      return (
        <Card key={set.id} data-testid="vocab-set-card" className={`!p-3 flex flex-col gap-2.5 h-full min-w-0 group ${cardClass}`}>
          {isNew && newBadge(newText, 'primary')}
          <h3
            className="text-[15px] font-bold leading-snug line-clamp-2 break-words [overflow-wrap:anywhere] hover:text-primary transition-colors cursor-pointer hover:underline"
            title={cleanTitle}
            onClick={() => openPreview(set.id)}
          >
            {cleanTitle}
            {set.isDraft && <span className="ml-2 text-[12px] uppercase bg-text-faint text-white px-2 py-0.5 rounded-full">DRAFT</span>}
          </h3>
          {set.description && <p className="text-content-muted text-xs line-clamp-1" title={set.description}>{set.description}</p>}
          <p className="truncate text-xs text-content-muted" title={meta}>{meta}</p>
          {masteryBar(set.id)}
          <div className="mt-auto pt-3 border-t border-line flex items-center gap-1.5">{actions(false)}</div>
        </Card>
      );
    }

    return (
      <div key={set.id} data-testid="vocab-set-card" className={`flex flex-col @lg:flex-row @lg:items-center gap-3 p-4 rounded-xl min-w-0 transition-all duration-300 ${cardClass}`}>
        <div className="min-w-0 flex-1">
          <h3
            className="min-w-0 text-base font-bold hover:text-primary transition-colors cursor-pointer hover:underline truncate"
            title={cleanTitle}
            onClick={() => openPreview(set.id)}
          >
            {cleanTitle}
            {set.isDraft && <span className="ml-2 text-[12px] uppercase bg-text-faint text-white px-2 py-0.5 rounded-full">DRAFT</span>}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-muted mt-1.5">
            {isNew && newBadge(newText, 'primary')}
            {createdDate && <span className="font-mono text-content whitespace-nowrap">{createdDate}</span>}
            <span className="inline-flex items-center bg-base-300 px-2 py-0.5 rounded-md text-content font-mono whitespace-nowrap">{cardsLabel(set)}</span>
            <span className={`font-mono whitespace-nowrap ${masteryOf(set.id) >= 80 ? 'text-primary font-bold' : ''}`}>{labels.mastery} {masteryOf(set.id)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 @lg:ml-auto shrink-0 max-w-full">{actions(!embedded)}</div>
      </div>
    );
  };

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-8 max-w-6xl mx-auto pb-12'} ref={containerRef} data-testid="flashcard-sets-screen">
      {/* Header (w trybie osadzonym tytuł niesie zakładka, zostaje tylko pasek narzędzi) */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${embedded ? 'sm:justify-end' : ''}`}>
        {!embedded && <h1 className="text-3xl font-extrabold tracking-tight">{language === 'pl' ? 'Moje Listy Słów' : 'My Word Lists'}</h1>}
        <div className="flex flex-wrap gap-3">
          
          <div className="flex bg-base-300 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors ${viewMode === 'list' ? 'bg-primary text-accent-ink shadow-sm' : 'text-content-muted hover:text-white'}`}
            >
              ☰
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors ${viewMode === 'grid' ? 'bg-primary text-accent-ink shadow-sm' : 'text-content-muted hover:text-white'}`}
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
        <div className={`@container ${embedded ? "space-y-3" : "mt-6 space-y-3"}`}>
          <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-line text-warn">
            📚 {language === 'pl' ? 'Słownictwo z lekcji' : 'Lesson Vocabulary'}
          </h2>
          <div className={viewMode === 'grid' ? "grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3 items-stretch" : "flex flex-col gap-2"}>
            {lessonSets.map((set, idx) => renderLessonSet(set, idx, viewMode))}
          </div>
        </div>
      )}

      {/* Remaining Vocabulary Section */}
      <div className={`@container ${embedded ? "space-y-3" : "mt-6 space-y-3"}`}>
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-line text-primary">
          📝 {language === 'pl' ? 'Słownictwo prywatne' : 'Private Vocabulary'}
        </h2>
        <div className={viewMode === 'grid' ? "grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3 items-stretch" : "flex flex-col gap-2"}>
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
            <div className="w-[80vw] max-w-3xl h-[80dvh] max-h-[600px] bg-primary/10 rounded-full blur-[120px]"></div>
          </div>
          <div className="w-full max-w-3xl lg:max-w-4xl bg-base-200/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_60px_rgba(114, 240, 180,0.15)] max-h-[85dvh] flex flex-col relative z-10 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">{language === 'pl' ? 'Podgląd słownictwa' : 'Vocabulary Preview'}</h3>
              <button onClick={() => setPreviewSetId(null)} className="text-content-muted hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 inline-flex items-center justify-center pointer-coarse:min-h-11 pointer-coarse:min-w-11">
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
