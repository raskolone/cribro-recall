import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSettings } from '../../context/SettingsContext';
import { playSpeech } from '../../services/ttsService';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Flashcard, FlashcardSet } from '../../types';
import { GENERAL_VOCABULARY_SETS } from '../../data/generalVocabulary';
import PronunciationMic from '../ui/PronunciationMic';
import TTSButtons from './TTSButtons';
import ConfirmModal from '../ui/ConfirmModal';
import i18n from "i18next";

interface FlashcardStudyScreenProps {
  setId: string;
  initialMode?: StudyMode;
  onBack: () => void;
  onNavigate?: (view: string) => void;
  onStartAIPractice?: () => void;
}

type StudyMode = 'flashcards' | 'quiz' | 'writing' | 'matching' | 'intro' | null;

const FlashcardStudyScreen: React.FC<FlashcardStudyScreenProps> = ({ setId, initialMode = null, onBack, onNavigate, onStartAIPractice }) => {
  const { sets, getFlashcards, saveSession } = useFlashcards();
  const { t, language } = useLanguage();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<StudyMode>(initialMode || null);
  const [isReversed, setIsReversed] = useState(false);

  const [confirmModalState, setConfirmModalState] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void}>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModalState({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };


  useEffect(() => {
    if (initialMode) {
      setSelectedMode(initialMode === ('match' as any) ? 'matching' : initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (!setId) {
      setIsLoading(false);
      return;
    }
    const currentSet = sets.find(s => s.id === setId);
    if (currentSet) {
      setSet(currentSet);
    } else {
      const cleanGenId = setId.replace(/^vocab-/, '').replace(/^set-/, '');
      const genSet = GENERAL_VOCABULARY_SETS.find(s => 
        s.id === setId || 
        s.id === cleanGenId || 
        `gen-${s.id}` === setId || 
        s.id === `gen-${cleanGenId}` ||
        s.id === setId.replace(/^gen-/, '')
      );
      if (genSet) {
        setSet({
          id: genSet.id,
          userId: 'system',
          title: genSet.title,
          description: genSet.description,
          isPublic: true,
          cardCount: genSet.words.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isGeneral: true
        });
      } else if (setId === 'basket') {
        setSet({
          id: 'basket',
          userId: 'local',
          title: language === 'pl' ? 'Mój Koszyk Słówek' : 'My Word Basket',
          description: language === 'pl' ? 'Wybrane słówka dodane do koszyka' : 'Selected words in basket',
          isPublic: false,
          cardCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        setSet({
          id: setId,
          userId: 'user',
          title: language === 'pl' ? 'Zestaw Słówek' : 'Word Set',
          isPublic: false,
          cardCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    const loadCards = async () => {
      const loadedCards = await getFlashcards(setId);
      setCards(loadedCards);
      setIsLoading(false);
    };
    
    loadCards();
  }, [setId, sets, getFlashcards, language]);

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!setId) {
    return (
      <div className="flex flex-col items-center justify-center p-8 mt-12 bg-base-200/50 rounded-3xl max-w-lg mx-auto text-center border border-white/10">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl mb-6">
          🗂️
        </div>
        <h2 className="text-2xl font-bold mb-4">{language === 'pl' ? 'Nie wybrano źródła' : 'No source selected'}</h2>
        <p className="text-content-muted mb-8 text-sm leading-relaxed">
          {language === 'pl' 
            ? 'Aby rozpocząć ćwiczenie (fiszki, dopasowanie), wybierz najpierw materiał w zakładce słownictwa, z którego chcesz się uczyć.' 
            : 'To start an exercise (flashcards, matching), please select the material you want to study from the vocabulary tab first.'}
        </p>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={onBack}>
            {language === 'pl' ? 'Wróć' : 'Back'}
          </Button>
          <Button className="bg-primary text-accent-ink font-bold" onClick={() => onNavigate && onNavigate('flashcard-sets')}>
            {language === 'pl' ? 'Przejdź do Słownictwa' : 'Go to Vocabulary'}
          </Button>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center space-y-4">
        <p>{t('flashcards.emptySet')}</p>
        <Button onClick={onBack}>{t('flashcards.back')}</Button>
      </div>
    );
  }


  const renderModal = () => (
    <ConfirmModal
      isOpen={confirmModalState.isOpen}
      title={confirmModalState.title}
      message={confirmModalState.message}
      onConfirm={confirmModalState.onConfirm}
      onCancel={closeConfirm}
      confirmText={t('flashcards.quit') || (language === 'pl' ? 'Zakończ' : 'Quit')}
      cancelText={t('common.cancel') || (language === 'pl' ? 'Anuluj' : 'Cancel')}
    />
  );

  if (selectedMode === 'intro') {
    return <>{renderModal()}<IntroMode showConfirm={showConfirm} closeConfirm={closeConfirm} cards={cards} onBack={onBack} t={t} language={language} /></>;
  }

  if (selectedMode === 'quiz') {
    return <>{renderModal()}<QuizMode showConfirm={showConfirm} closeConfirm={closeConfirm} cards={cards} setId={setId} onBack={onBack} saveSession={saveSession}
        onNavigate={onNavigate}
        language={language} t={t} /></>;
  }

  if (selectedMode === 'writing') {
    return <>{renderModal()}<WritingMode showConfirm={showConfirm} closeConfirm={closeConfirm} cards={cards} setId={setId} onBack={onBack} saveSession={saveSession}
        onNavigate={onNavigate}
        language={language} t={t} /></>;
  }

  if (selectedMode === 'matching') {
    return <>{renderModal()}<MatchingMode showConfirm={showConfirm} closeConfirm={closeConfirm} cards={cards} setId={setId} onBack={onBack} saveSession={saveSession}
        onNavigate={onNavigate}
        language={language} t={t} /></>;
  }

  return (
    <>
      {renderModal()}
      <FlashcardsMode showConfirm={showConfirm} closeConfirm={closeConfirm} 
        cards={cards} 
        setId={setId} 
        onBack={onBack} 
        saveSession={saveSession}
        onNavigate={onNavigate}
        language={language}
        t={t}
      />
    </>
  );
};

// --- Flashcards Mode Component ---
const FlashcardsMode = ({ cards: initialCards, setId, onBack, saveSession, t, showConfirm, closeConfirm , onNavigate, language}: any) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<{ flashcardId: string; isCorrect: boolean; responseTimeMs: number }[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchCurrentRef = useRef<number | null>(null);

  const { getProgress } = useFlashcards();
  const { soundSettings } = useSettings();

  useEffect(() => {
    const loadCards = async () => {
      let progress: any[] = [];
      if (getProgress) {
         progress = await getProgress(setId);
      }
      
      const cardsWithProgress = initialCards.map((card: any) => {
        const prog = progress.find(p => p.flashcardId === card.id);
        return {
           ...card,
           nextReviewDate: prog?.nextReviewDate || '1970-01-01T00:00:00.000Z'
        };
      });

      cardsWithProgress.sort((a: any, b: any) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());
      
      setCards(cardsWithProgress);
      setStartTime(Date.now());
    };
    loadCards();
  }, [initialCards, setId, getProgress]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => {
      const nextState = !prev;
      if (soundSettings?.autoPlayFlashcards && cards[currentIndex]) {
        const textToSpeak = nextState ? cards[currentIndex].definition : cards[currentIndex].term;
        playSpeech(textToSpeak, {
          accent: soundSettings.ttsAccent,
          gender: soundSettings.voiceGender,
          speed: soundSettings.voiceSpeed,
          engine: soundSettings.soundEngine
        }).catch(() => {});
      }
      return nextState;
    });
  }, [cards, currentIndex, soundSettings]);

  const handleAnswer = useCallback(async (isCorrect: boolean) => {
    const responseTimeMs = Date.now() - startTime;
    const currentCard = cards[currentIndex];
    
    const newResults = [...results, {
      flashcardId: currentCard.id,
      isCorrect,
      responseTimeMs
    }];
    
    setResults(newResults);
    
    const proceed = async () => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        setStartTime(Date.now());
        
        // Reset card position with gsap
        if (cardContainerRef.current) {
          gsap.fromTo(cardContainerRef.current, 
            { x: isCorrect ? -200 : 200, opacity: 0, rotation: isCorrect ? -15 : 15 },
            { x: 0, opacity: 1, rotation: 0, duration: 0.4, ease: "back.out(1.5)", clearProps: "all" }
          );
        }
      } else {
        setIsFinished(true);
        const correctCount = newResults.filter(r => r.isCorrect).length;
        await saveSession({
          setId,
          mode: 'flashcards',
          totalCards: cards.length,
          correctCount,
          scorePercent: cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0
        }, newResults);
      }
    };

    if (cardContainerRef.current) {
      gsap.to(cardContainerRef.current, {
        x: isCorrect ? window.innerWidth : -window.innerWidth,
        rotation: isCorrect ? 45 : -45,
        opacity: 0,
        duration: 0.4,
        ease: "power2.in",
        onComplete: proceed
      });
    } else {
      proceed();
    }
  }, [currentIndex, cards, results, startTime, setId, saveSession]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const proceed = () => {
        setCurrentIndex(prev => prev - 1);
        setIsFlipped(false);
        
        if (cardContainerRef.current) {
          gsap.fromTo(cardContainerRef.current, 
            { x: 200, opacity: 0, rotation: 10 },
            { x: 0, opacity: 1, rotation: 0, duration: 0.4, ease: "back.out(1.5)", clearProps: "all" }
          );
        }
      };
      
      if (cardContainerRef.current) {
        gsap.to(cardContainerRef.current, {
          x: -window.innerWidth,
          rotation: -20,
          opacity: 0,
          duration: 0.3,
          ease: "power2.in",
          onComplete: proceed
        });
      } else {
        proceed();
      }
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      const proceed = () => {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        
        if (cardContainerRef.current) {
          gsap.fromTo(cardContainerRef.current, 
            { x: -200, opacity: 0, rotation: -10 },
            { x: 0, opacity: 1, rotation: 0, duration: 0.4, ease: "back.out(1.5)", clearProps: "all" }
          );
        }
      };

      if (cardContainerRef.current) {
        gsap.to(cardContainerRef.current, {
          x: window.innerWidth,
          rotation: 20,
          opacity: 0,
          duration: 0.3,
          ease: "power2.in",
          onComplete: proceed
        });
      } else {
        proceed();
      }
    }
  }, [currentIndex, cards.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
    touchCurrentRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    touchCurrentRef.current = e.touches[0].clientX;
    const diff = touchCurrentRef.current - touchStartRef.current;
    
    // Add visual feedback for swipe
    if (cardContainerRef.current && isFlipped) {
      gsap.to(cardContainerRef.current, {
        x: diff,
        rotation: diff * 0.05,
        duration: 0.1
      });
    } else if (cardContainerRef.current && !isFlipped) {
      gsap.to(cardContainerRef.current, {
        x: diff * 0.5, // resistance when not flipped
        rotation: diff * 0.02,
        duration: 0.1
      });
    }
  }, [isFlipped]);

  const handleTouchEnd = useCallback(() => {
    if (touchStartRef.current === null || touchCurrentRef.current === null) return;
    const diff = touchCurrentRef.current - touchStartRef.current;
    
    if (isFlipped) {
      if (diff > 80) {
        handleAnswer(true);
      } else if (diff < -80) {
        handleAnswer(false);
      } else {
        // snap back
        if (cardContainerRef.current) {
           gsap.to(cardContainerRef.current, { x: 0, rotation: 0, duration: 0.3, ease: "back.out(1.5)" });
        }
      }
    } else {
      if (diff > 80) {
        handlePrev();
      } else if (diff < -80) {
        handleNext();
      } else {
        // snap back
        if (cardContainerRef.current) {
           gsap.to(cardContainerRef.current, { x: 0, rotation: 0, duration: 0.3, ease: "back.out(1.5)" });
        }
      }
    }
    
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  }, [isFlipped, handleAnswer, handlePrev, handleNext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (isFlipped) {
          handleAnswer(false);
        } else {
          handlePrev();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (isFlipped) {
          handleAnswer(true);
        } else {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isFinished, handleFlip, handleAnswer, handlePrev, handleNext]);

  if (cards.length === 0) return null;

  if (isFinished) {
    const correctCount = results.filter(r => r.isCorrect).length;
    const score = cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0;
    
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('flashcards.complete')}</h2>
        <Card className="py-12">
          <div className="text-6xl font-black text-primary mb-4">{Number.isNaN(Number(score)) ? 0 : score}%</div>
          <p className="text-xl text-content-muted">
            {t('flashcards.score').replace('{correct}', correctCount.toString()).replace('{total}', cards.length.toString())}
          </p>
        </Card>
                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
          <Button onClick={onBack} variant="secondary" className="flex-1">{t('flashcards.back')}</Button>
          <Button onClick={() => { if (onNavigate) onNavigate('ai-generator', { setId: setId, initialMode: 'flashcards', autoGenerate: true }); }} className="flex-1">
            {language === 'pl' ? 'Przećwicz w zdaniach' : 'Practice in sentences'}
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { showConfirm(
            t('flashcards.confirmQuitTitle') || 'Zakończ', 
            t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?', 
            () => { closeConfirm(); onBack(); }
          ); }} className="text-content-muted hover:text-white flex items-center gap-2">
          
                            {i18n.t("&larr;")} {t('flashcards.quit')}
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsReversed(!isReversed)}
            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-text-2"
          >
            {isReversed ? 'PL -> EN' : 'EN -> PL'}
          </button>
          <div className="font-mono text-sm">
            {currentIndex + 1} / {cards.length}
          </div>
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0}%` }}
        />
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={handlePrev} 
          disabled={currentIndex === 0}
          className={`hidden md:flex p-4 rounded-full transition-colors ${currentIndex === 0 ? 'text-base-300 cursor-not-allowed' : 'text-content hover:bg-base-300'}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div className="flex-1 perspective-1000">
          <div>
            <div 
              ref={cardContainerRef}
              className="relative w-full aspect-[3/2] cursor-pointer touch-pan-y"
              onClick={handleFlip}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <motion.div 
                className="w-full h-full relative preserve-3d"
                initial={false}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 200, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Front Side */}
                <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-white/10 hover:border-primary/50 transition-colors" style={{ backfaceVisibility: 'hidden' }}>
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <PronunciationMic targetWord={currentCard.term.replace(/<[^>]+>/g, '')} />
                    <TTSButtons text={currentCard.term} />
                  </div>
                  <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{t('flashcards.term')}</div>
                  <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.term }} />
                </Card>
                
                {/* Back Side */}
                <Card 
                  className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-primary/50 shadow-[0_0_30px_rgba(114,240,180,0.15)]" 
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <TTSButtons text={currentCard.definition} />
                  </div>
                  <div className="text-sm font-mono text-primary uppercase tracking-widest mb-8">{t('flashcards.definition')}</div>
                  <div className="text-3xl md:text-4xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.definition }} />
                </Card>
              </motion.div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleNext} 
          disabled={currentIndex === cards.length - 1}
          className={`hidden md:flex p-4 rounded-full transition-colors ${currentIndex === cards.length - 1 ? 'text-base-300 cursor-not-allowed' : 'text-content hover:bg-base-300'}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <div className="flex justify-between md:hidden px-4">
         <button onClick={handlePrev} disabled={currentIndex === 0} className={`p-2 ${currentIndex === 0 ? 'opacity-30' : ''}`}>← {language === 'pl' ? 'Poprzednia' : 'Previous'}</button>
         <button onClick={handleNext} disabled={currentIndex === cards.length - 1} className={`p-2 ${currentIndex === cards.length - 1 ? 'opacity-30' : ''}`}>{language === 'pl' ? 'Następna' : 'Next'} →</button>
      </div>

      {isFlipped ? (
        <div className="grid grid-cols-2 gap-4 mt-8">
          <Button variant="danger" className="py-4 text-lg flex flex-col items-center justify-center gap-1" onClick={() => handleAnswer(false)}>
            <span>{i18n.t("Nie umiem")}</span>
            <span className="text-[10px] uppercase opacity-70">{i18n.t("Nie umiem (Strzałka w lewo)")}</span>
          </Button>
          <Button className="py-4 text-lg flex flex-col items-center justify-center gap-1" onClick={() => handleAnswer(true)}>
            <span>{i18n.t("Umiem")}</span>
            <span className="text-[10px] uppercase opacity-70">{i18n.t("Umiem (Strzałka w prawo)")}</span>
          </Button>
        </div>
      ) : (
        <div className="text-center text-content-muted text-sm animate-pulse mt-8 flex flex-col items-center gap-2">
          <span>{t('flashcards.clickReveal')}</span>
          <span className="bg-base-300 px-2 py-1 rounded text-xs">{i18n.t("Spacja")}</span>
        </div>
      )}
    </div>
  );
};

// --- Quiz Mode Component ---
const QuizMode = ({ cards: initialCards, setId, onBack, saveSession, t, showConfirm, closeConfirm , onNavigate, language}: any) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState<{ flashcardId: string; isCorrect: boolean; responseTimeMs: number }[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isReversed, setIsReversed] = useState(false);

  useEffect(() => {
    const shuffled = [...initialCards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setStartTime(Date.now());
  }, [initialCards]);

  useEffect(() => {
    if (cards.length > 0 && currentIndex < cards.length) {
      const currentCard = cards[currentIndex];
      const otherCards = initialCards.filter((c: Flashcard) => c.id !== currentCard.id);
      const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5).slice(0, 3);
      
      const newOptions = [currentCard.definition, ...shuffledOthers.map((c: Flashcard) => c.definition)]
        .sort(() => Math.random() - 0.5);
        
      setOptions(newOptions);
      setSelectedOption(null);
      setIsCorrect(null);
    }
  }, [cards, currentIndex, initialCards]);

  const handleAnswer = async (option: string) => {
    if (selectedOption !== null) return; // Prevent multiple clicks
    
    const currentCard = cards[currentIndex];
    const correct = option === currentCard.definition;
    const responseTimeMs = Date.now() - startTime;
    
    setSelectedOption(option);
    setIsCorrect(correct);
    
    const newResults = [...results, {
      flashcardId: currentCard.id,
      isCorrect: correct,
      responseTimeMs
    }];
    
    setResults(newResults);
    
    setTimeout(async () => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setStartTime(Date.now());
      } else {
        setIsFinished(true);
        const correctCount = newResults.filter(r => r.isCorrect).length;
        await saveSession({
          setId,
          mode: 'quiz',
          totalCards: cards.length,
          correctCount,
          scorePercent: cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0
        }, newResults);
      }
    }, correct ? 1000 : 2000); // Wait longer if wrong to show correct answer
  };

  if (cards.length === 0) return null;

  if (isFinished) {
    const correctCount = results.filter(r => r.isCorrect).length;
    const score = cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0;
    
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('flashcards.complete')}</h2>
        <Card className="py-12">
          <div className="text-6xl font-black text-primary mb-4">{Number.isNaN(Number(score)) ? 0 : score}%</div>
          <p className="text-xl text-content-muted">
            {t('flashcards.score').replace('{correct}', correctCount.toString()).replace('{total}', cards.length.toString())}
          </p>
        </Card>
                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
          <Button onClick={onBack} variant="secondary" className="flex-1">{t('flashcards.back')}</Button>
          <Button onClick={() => { if (onNavigate) onNavigate('ai-generator', { setId: setId, initialMode: 'flashcards', autoGenerate: true }); }} className="flex-1">
            {language === 'pl' ? 'Przećwicz w zdaniach' : 'Practice in sentences'}
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { showConfirm(
            t('flashcards.confirmQuitTitle') || 'Zakończ', 
            t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?', 
            () => { closeConfirm(); onBack(); }
          ); }} className="text-content-muted hover:text-white flex items-center gap-2">
          
                            {i18n.t("&larr;")} {t('flashcards.quit')}
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsReversed(!isReversed)}
            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-text-2"
          >
            {isReversed ? 'PL -> EN' : 'EN -> PL'}
          </button>
          <div className="font-mono text-sm">
            {currentIndex + 1} / {cards.length}
          </div>
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0}%` }}
        />
      </div>

      <Card className="relative flex flex-col items-center justify-center text-center p-12 border border-white/10 min-h-[200px]">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <PronunciationMic targetWord={currentCard?.term.replace(/<[^>]+>/g, '') || ''} />
          {currentCard?.term && <TTSButtons text={currentCard.term} />}
        </div>
        <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{t('flashcards.term')}</div>
        <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard?.term || '' }} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, i) => {
          let btnClass = "py-6 text-lg h-auto whitespace-normal break-words";
          if (selectedOption !== null) {
            if (option === currentCard.definition) {
              btnClass += " bg-primary/20 border-primary text-primary";
            } else if (option === selectedOption) {
              btnClass += " bg-danger/20 border-danger text-danger";
            } else {
              btnClass += " opacity-50";
            }
          }
          
          return (
            <Button 
              key={i} 
              variant="secondary"
              className={btnClass} 
              onClick={() => handleAnswer(option)}
              disabled={selectedOption !== null}
            >
              <span dangerouslySetInnerHTML={{ __html: option }} />
            </Button>
          );
        })}
      </div>
    </div>
  );
};

// --- Writing Mode Component ---
const levenshteinDistance = (a: string, b: string) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
};

const stripHtml = (html: string) => {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const WritingMode = ({ cards: initialCards, setId, onBack, saveSession, t, showConfirm, closeConfirm , onNavigate, language}: any) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'typing' | 'correct' | 'incorrect'>('typing');
  const [results, setResults] = useState<{ flashcardId: string; isCorrect: boolean; responseTimeMs: number }[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const shuffled = [...initialCards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setStartTime(Date.now());
  }, [initialCards]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'typing' || !input.trim()) return;
    
    const currentCard = cards[currentIndex];
    const normalizedInput = input.trim().toLowerCase();
    const normalizedAnswer = stripHtml(currentCard.definition).trim().toLowerCase();
    
    // Fuzzy match (Levenshtein ≤ 2)
    const distance = levenshteinDistance(normalizedInput, normalizedAnswer);
    const isCorrect = distance <= 2;
    
    setStatus(isCorrect ? 'correct' : 'incorrect');
    
    const responseTimeMs = Date.now() - startTime;
    const newResults = [...results, {
      flashcardId: currentCard.id,
      isCorrect,
      responseTimeMs
    }];
    
    setResults(newResults);
    
    setTimeout(async () => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setInput('');
        setStatus('typing');
        setStartTime(Date.now());
      } else {
        setIsFinished(true);
        const correctCount = newResults.filter(r => r.isCorrect).length;
        await saveSession({
          setId,
          mode: 'writing',
          totalCards: cards.length,
          correctCount,
          scorePercent: cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0
        }, newResults);
      }
    }, isCorrect ? 1000 : 3000); // Wait longer if wrong to show correct answer
  };

  if (cards.length === 0) return null;

  if (isFinished) {
    const correctCount = results.filter(r => r.isCorrect).length;
    const score = cards.length > 0 ? Math.round((correctCount / cards.length) * 100) : 0;
    
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('flashcards.complete')}</h2>
        <Card className="py-12">
          <div className="text-6xl font-black text-primary mb-4">{Number.isNaN(Number(score)) ? 0 : score}%</div>
          <p className="text-xl text-content-muted">
            {t('flashcards.score').replace('{correct}', correctCount.toString()).replace('{total}', cards.length.toString())}
          </p>
        </Card>
                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
          <Button onClick={onBack} variant="secondary" className="flex-1">{t('flashcards.back')}</Button>
          <Button onClick={() => { if (onNavigate) onNavigate('ai-generator', { setId: setId, initialMode: 'flashcards', autoGenerate: true }); }} className="flex-1">
            {language === 'pl' ? 'Przećwicz w zdaniach' : 'Practice in sentences'}
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { showConfirm(
            t('flashcards.confirmQuitTitle') || 'Zakończ', 
            t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?', 
            () => { closeConfirm(); onBack(); }
          ); }} className="text-content-muted hover:text-white flex items-center gap-2">
          
                            {i18n.t("&larr;")} {t('flashcards.quit')}
        </button>
        <div className="font-mono text-sm">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0}%` }}
        />
      </div>

      <Card className="relative flex flex-col items-center justify-center text-center p-12 border border-white/10 min-h-[200px]">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <PronunciationMic targetWord={currentCard?.term.replace(/<[^>]+>/g, '') || ''} />
          {currentCard?.term && <TTSButtons text={currentCard.term} />}
        </div>
        <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{t('flashcards.term')}</div>
        <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard?.term || '' }} />
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={status !== 'typing'}
            autoFocus
            className={`w-full px-6 py-4 text-xl bg-base-100 border-2 rounded-xl focus:outline-none transition-colors ${
              status === 'correct' ? 'border-primary text-primary' :
              status === 'incorrect' ? 'border-danger text-danger' :
              'border-base-300 focus:border-primary'
            }`}
            placeholder={i18n.t("Type the definition...")}
          />
        </div>
        
        {status === 'incorrect' && (
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-center">
            <div className="text-sm text-danger mb-1">{i18n.t("Correct answer:")}</div>
            <div className="text-xl font-bold text-white" dangerouslySetInnerHTML={{ __html: currentCard?.definition || '' }} />
          </div>
        )}
        
        {status === 'typing' && (
          <Button type="submit" className="w-full py-4 text-lg" disabled={!input.trim()}>
            
                                  {i18n.t("Submit")}
                                </Button>
        )}
      </form>
    </div>
  );
};

// --- Matching Mode Component ---
const MatchingMode = ({ cards: initialCards, setId, onBack, saveSession, t, showConfirm, closeConfirm , onNavigate, language}: any) => {
  const [items, setItems] = useState<{ id: string; text: string; type: 'term' | 'definition'; flashcardId: string; isMatched: boolean }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [mistakes, setMistakes] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    // Take up to 6 random cards for matching to fit on screen
    const selectedCards = [...initialCards].sort(() => Math.random() - 0.5).slice(0, 6);
    
    const newItems = selectedCards.flatMap(card => [
      { id: `t_${card.id}`, text: card.term, type: 'term' as const, flashcardId: card.id, isMatched: false },
      { id: `d_${card.id}`, text: card.definition, type: 'definition' as const, flashcardId: card.id, isMatched: false }
    ]).sort(() => Math.random() - 0.5);
    
    setItems(newItems);
    setStartTime(Date.now());
    
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [initialCards, startTime]);

  const handleItemClick = async (item: any) => {
    if (item.isMatched || wrongPair) return;
    
    if (!selectedId) {
      setSelectedId(item.id);
      return;
    }
    
    if (selectedId === item.id) {
      setSelectedId(null); // Deselect
      return;
    }
    
    const selectedItem = items.find(i => i.id === selectedId);
    if (!selectedItem) return;
    
    // Check if same type (can't match term with term)
    if (selectedItem.type === item.type) {
      setSelectedId(item.id);
      return;
    }
    
    // Check match
    if (selectedItem.flashcardId === item.flashcardId) {
      // Match!
      const newItems = items.map(i => 
        (i.id === selectedId || i.id === item.id) ? { ...i, isMatched: true } : i
      );
      setItems(newItems);
      setSelectedId(null);
      
      // Check if finished
      if (newItems.every(i => i.isMatched)) {
        setIsFinished(true);
        const timeScore = Math.max(0, 100 - elapsedTime - (mistakes * 5));
        await saveSession({
          setId,
          mode: 'matching',
          totalCards: newItems.length / 2,
          correctCount: newItems.length / 2,
          scorePercent: timeScore
        }, []);
      }
    } else {
      // Wrong!
      setMistakes(m => m + 1);
      setWrongPair([selectedId, item.id]);
      setTimeout(() => {
        setWrongPair(null);
        setSelectedId(null);
      }, 1000);
    }
  };

  if (items.length === 0) return null;

  if (isFinished) {
    const timeScore = Math.max(0, 100 - elapsedTime - (mistakes * 5));
    
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('flashcards.complete')}</h2>
        <Card className="py-12">
          <div className="text-6xl font-black text-primary mb-4">{timeScore}  {i18n.t("pts")}</div>
          <p className="text-xl text-content-muted mb-2">
            
                                {i18n.t("Time:")} {elapsedTime}s
          </p>
          <p className="text-xl text-content-muted">
            
                                {i18n.t("Mistakes:")} {mistakes}
          </p>
        </Card>
                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
          <Button onClick={onBack} variant="secondary" className="flex-1">{t('flashcards.back')}</Button>
          <Button onClick={() => { if (onNavigate) onNavigate('ai-generator', { setId: setId, initialMode: 'flashcards', autoGenerate: true }); }} className="flex-1">
            {language === 'pl' ? 'Przećwicz w zdaniach' : 'Practice in sentences'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { showConfirm(
            t('flashcards.confirmQuitTitle') || (language === 'pl' ? 'Zakończ Sesję' : 'Quit Session'), 
            t('flashcards.confirmQuit') || (language === 'pl' ? 'Czy na pewno chcesz zakończyć sesję?' : 'Are you sure you want to quit the session?'), 
            () => { closeConfirm(); onBack(); }
          ); }} className="text-content-muted hover:text-white flex items-center gap-2">
          ← {t('flashcards.quit') || (language === 'pl' ? 'Zakończ' : 'Quit')}
        </button>
        <div className="font-mono text-xl font-bold">
          {elapsedTime}s
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((item) => {
          if (item.isMatched) {
            return (
              <div key={item.id} className="h-24 md:h-32 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 opacity-50 transition-all duration-500" />
            );
          }
          
          const isSelected = selectedId === item.id;
          const isWrong = wrongPair?.includes(item.id);
          
          return (
            <Card 
              key={item.id}
              className={`relative h-24 md:h-32 p-3 flex items-center justify-center text-center cursor-pointer transition-all duration-200 select-none touch-manipulation ${
                isSelected ? 'border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20' : 
                isWrong ? 'border-danger bg-danger/10 animate-shake' : 
                'hover:border-base-300 hover:bg-base-200/50'
              }`}
              onClick={() => handleItemClick(item)}
            >
              <div className="absolute top-1 right-1" onClick={(e) => e.stopPropagation()}>
                <TTSButtons text={item.text} />
              </div>
              <span className="font-medium text-sm md:text-lg leading-tight line-clamp-3 mt-4" dangerouslySetInnerHTML={{ __html: item.text }} />
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// --- Intro Mode Component ---
const IntroMode = ({ cards, onBack, t, showConfirm, closeConfirm, language }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReversed, setIsReversed] = useState(false);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      onBack();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { showConfirm(
            t('flashcards.confirmQuitTitle') || (language === 'pl' ? 'Zakończ Sesję' : 'Quit Session'), 
            t('flashcards.confirmQuit') || (language === 'pl' ? 'Czy na pewno chcesz zakończyć sesję?' : 'Are you sure you want to quit the session?'), 
            () => { closeConfirm(); onBack(); }
          ); }} className="text-content-muted hover:text-white flex items-center gap-2">
          ← {t('flashcards.quit') || (language === 'pl' ? 'Zakończ' : 'Quit')}
        </button>
        <div className="font-mono text-sm">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-secondary h-full transition-all duration-300"
          style={{ width: `${cards.length > 0 ? Math.min(100, Math.max(0, ((currentIndex + 1) / cards.length) * 100)) : 0}%` }}
        />
      </div>

      <div 
        className="relative w-full aspect-[3/2] perspective-1000 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-white/10 hover:border-secondary/50 transition-colors">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <PronunciationMic targetWord={isReversed ? currentCard.definition.replace(/<[^>]+>/g, '') : currentCard.term.replace(/<[^>]+>/g, '')} />
              <TTSButtons text={isReversed ? currentCard.definition : currentCard.term} />
            </div>
            <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{isReversed ? t('flashcards.definition') : t('flashcards.term')}</div>
            <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: isReversed ? currentCard.definition : currentCard.term }} />
          </Card>
          
          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-secondary/50 rotate-y-180">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <TTSButtons text={isReversed ? currentCard.term : currentCard.definition} />
            </div>
            <div className="text-sm font-mono text-secondary uppercase tracking-widest mb-8">{isReversed ? t('flashcards.term') : t('flashcards.definition')}</div>
            <div className="text-3xl md:text-4xl font-bold" dangerouslySetInnerHTML={{ __html: isReversed ? currentCard.term : currentCard.definition }} />
          </Card>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={handlePrev} disabled={currentIndex === 0}>
          ← {language === 'pl' ? 'Poprzednia' : 'Previous'}
        </Button>
        <Button onClick={handleNext}>
          {currentIndex === cards.length - 1 ? 'Finish' : 'Next \u2192'}
        </Button>
      </div>
    </div>
  );
};

export default FlashcardStudyScreen;
