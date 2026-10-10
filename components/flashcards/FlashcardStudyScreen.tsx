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
import MatchingGame from './MatchingGame';
import FlashcardFace from './FlashcardFace';
import { enterFromVars, enterVars, exitVars, ratingExitVars } from '../../utils/flashcardCardMotion';
import { prefersReducedMotion } from '../../services/gsapAnimations';
import SwipeRatingHint from './SwipeRatingHint';
import QuizOption from './QuizOption';
import { mergeSetCards, splitSessionBySet } from '../../utils/multiSetSession';
import { quizOptionState } from '../../utils/quizOptionStates';
import { SWIPE_TOUCH_ACTION_CLASS } from '../../hooks/useCardSwipe';
import { useRatingSwipe } from '../../hooks/useRatingSwipe';
import ConfirmModal from '../ui/ConfirmModal';
import i18n from "i18next";
import {
  createFlashcardQueue,
  getCurrentCard,
  canLeaveCurrentForLater,
  rateCurrentCard,
  leaveCurrentForLater,
  getSessionSummary,
  type FlashcardQueueState,
} from '../../utils/flashcardQueue';
import WhatsNextSection from '../practice/WhatsNextSection';
import { sameCardList } from '../../utils/cardListEquality';

interface FlashcardStudyScreenProps {
  setId: string;
  /**
   * Ćwiczenie z kilku zestawów („Ćwiczenia dowolne"): karty z wszystkich zestawów w jednej sesji,
   * wynik zapisywany istniejącym `saveSession` osobno dla każdego zestawu. Przy jednym zestawie
   * (lub braku) działa jak dotąd.
   */
  setIds?: string[];
  initialMode?: StudyMode;
  onBack: () => void;
  onNavigate?: (view: any, extra?: any) => void;
  onStartAIPractice?: () => void;
  focusWords?: string[];
}

type StudyMode = 'flashcards' | 'quiz' | 'writing' | 'matching' | 'intro' | null;

const FlashcardStudyScreen: React.FC<FlashcardStudyScreenProps> = ({ setId, setIds, initialMode = null, onBack, onNavigate, onStartAIPractice, focusWords }) => {
  const { sets, getFlashcards, saveSession } = useFlashcards();
  const { t, language } = useLanguage();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<StudyMode>(initialMode || null);
  const [activeFocusWords, setActiveFocusWords] = useState<string[]>(() => focusWords || (window as any)._focusWords || []);
  const [isReversed, setIsReversed] = useState(false);
  const multiIds = setIds && setIds.length > 1 ? setIds : null;
  const multiKey = multiIds ? multiIds.join('|') : '';
  // id karty → zestaw, z którego pochodzi (do podziału zapisu wyniku); tylko przy wielu zestawach.
  const cardSetMapRef = useRef<Record<string, string>>({});
  const originalIdsRef = useRef<Record<string, string>>({});

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
      if (multiKey) {
        // Zestawy wybrane na ekranie „Ćwiczenia dowolne": tylko istniejące, niepuste (ekran nie
        // pozwala wybrać innych), więc nigdy nie wpadamy w generowanie fiszek z tematu.
        const ids = multiKey.split('|');
        const lists = await Promise.all(ids.map(async (id) => ({ id, cards: await getFlashcards(id) })));
        const merged = mergeSetCards(lists.map(({ id, cards: list }) => ({ setId: id, cards: list })));
        cardSetMapRef.current = merged.cardSetMap;
        originalIdsRef.current = merged.originalIds;
        // Ta sama talia = ta sama tablica: ponowne ładowanie po renderze dostawcy (np. po zapisie
        // sesji) nie może zerować trwającej ani zakończonej sesji w żadnym trybie.
        setCards(prev => (sameCardList(prev, merged.cards) ? prev : merged.cards));
        setIsLoading(false);
        return;
      }
      const loadedCards = await getFlashcards(setId);
      setCards(prev => (sameCardList(prev, loadedCards) ? prev : loadedCards));
      setIsLoading(false);
    };
    
    loadCards();
  }, [setId, sets, getFlashcards, language, multiKey]);

  // Zapis wyniku: jeden zestaw = jak dotąd; kilka = osobny `saveSession` dla każdego zestawu.
  const saveSessionForScope = useCallback(
    async (sessionData: any, results: any[]) => {
      if (!multiKey) return saveSession(sessionData, results);
      const parts = splitSessionBySet(sessionData, results, cardSetMapRef.current, multiKey.split('|')[0], originalIdsRef.current);
      for (const part of parts) await saveSession(part.sessionData, part.results);
    },
    [multiKey, saveSession],
  );

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
    return <>{renderModal()}<QuizMode showConfirm={showConfirm} closeConfirm={closeConfirm} cards={cards} setId={setId} onBack={onBack} saveSession={saveSessionForScope}
        onNavigate={onNavigate}
        language={language} t={t} focusWords={activeFocusWords} /></>;
  }

  if (selectedMode === 'writing') {
    return <>{renderModal()}<WritingMode showConfirm={showConfirm} closeConfirm={closeConfirm} cards={cards} setId={setId} onBack={onBack} saveSession={saveSessionForScope}
        onNavigate={onNavigate}
        language={language} t={t} /></>;
  }

  if (selectedMode === 'matching') {
    return <>{renderModal()}<MatchingMode showConfirm={showConfirm} closeConfirm={closeConfirm} cards={cards} setId={setId} onBack={onBack} saveSession={saveSessionForScope}
        onNavigate={onNavigate}
        language={language} t={t}
        onStartQuiz={(wrongWords: string[]) => {
          setActiveFocusWords(wrongWords);
          setSelectedMode('quiz');
        }}
        onStartSentences={(format: 'translation' | 'correction', wrongWords: string[]) => {
          // Szybki start: ćwiczenia dowolne od kroku 3 z ustawionymi rodzajem, zestawami i słowami słabymi.
          if (onNavigate) {
            onNavigate('free-practice', {
              quickStart: { mode: format, setIds: setIds && setIds.length > 0 ? setIds : [setId], focusWords: wrongWords },
            });
          }
        }}
      /></>;
  }

  return (
    <>
      {renderModal()}
      <FlashcardsMode showConfirm={showConfirm} closeConfirm={closeConfirm} 
        cards={cards} 
        setId={setId} 
        onBack={onBack} 
        saveSession={saveSessionForScope}
        multi={Boolean(multiKey)}
        onNavigate={onNavigate}
        language={language}
        t={t}
        onStartQuiz={(weakWords: string[]) => {
          setActiveFocusWords(weakWords);
          setSelectedMode('quiz');
        }}
        onStartSentences={(format: 'translation' | 'correction', weakWords: string[]) => {
          // Szybki start: ćwiczenia dowolne od kroku 3 z ustawionymi rodzajem, zestawami i słowami słabymi.
          if (onNavigate) {
            onNavigate('free-practice', {
              quickStart: { mode: format, setIds: setIds && setIds.length > 0 ? setIds : [setId], focusWords: weakWords },
            });
          }
        }}
      />
    </>
  );
};

// --- Flashcards Mode Component ---
const FlashcardsMode = ({ cards: initialCards, setId, multi, onBack, saveSession, t, showConfirm, closeConfirm , onNavigate, language, onStartQuiz, onStartSentences}: any) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [queueState, setQueueState] = useState<FlashcardQueueState<Flashcard>>(() => createFlashcardQueue([]));
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const knowHintRef = useRef<HTMLDivElement>(null);
  const dontKnowHintRef = useRef<HTMLDivElement>(null);
  // Odlot po ocenie trwa ~0,4 s: w tym czasie nie przyjmujemy kolejnej oceny ani gestu.
  const answeringRef = useRef(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [isReversed, setIsReversed] = useState(false);

  const { getProgress } = useFlashcards();
  const { soundSettings } = useSettings();
  // `getProgress` z FlashcardContext dostaje nową tożsamość przy KAŻDYM renderze dostawcy, a dostawca
  // renderuje się po zapisie sesji (nasłuch `sessions`). Gdyby efekt ładowania zależał od tej funkcji,
  // zapis wyniku na końcu talii zerowałby kolejkę i zamiast „Co dalej?" wracała nowa sesja „0 z N".
  const getProgressRef = useRef(getProgress);
  getProgressRef.current = getProgress;

  useEffect(() => {
    const loadCards = async () => {
      let progress: any[] = [];
      if (getProgressRef.current) {
         // wiele zestawów: postęp SRS wszystkich kart kursanta (dopasowanie po `flashcardId`)
         progress = await getProgressRef.current(multi ? undefined : setId);
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
      setQueueState(createFlashcardQueue(cardsWithProgress));
      setStartTime(Date.now());
    };
    loadCards();
  }, [initialCards, setId, multi]);

  const currentCard = getCurrentCard(queueState);
  const canLeaveLater = canLeaveCurrentForLater(queueState);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => {
      const nextState = !prev;
      if (soundSettings?.autoPlayFlashcards && currentCard) {
        const textToSpeak = nextState ? currentCard.definition : currentCard.term;
        playSpeech(textToSpeak, {
          accent: soundSettings.ttsAccent,
          gender: soundSettings.voiceGender,
          speed: soundSettings.voiceSpeed,
          engine: soundSettings.soundEngine
        }).catch(() => {});
      }
      return nextState;
    });
  }, [currentCard, soundSettings]);

  const handleAnswer = useCallback(async (isCorrect: boolean) => {
    if (answeringRef.current || !currentCard) return;
    answeringRef.current = true;
    const responseTimeMs = Date.now() - startTime;
    const nextState = rateCurrentCard(queueState, isCorrect, responseTimeMs);
    setQueueState(nextState);

    const proceed = async () => {
      answeringRef.current = false;
      if (!nextState.isFinished) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        setStartTime(Date.now());
        
        // Reset card position with gsap
        if (cardContainerRef.current) {
          const enter = enterFromVars(isCorrect ? -1 : 1, 15);
          gsap.fromTo(cardContainerRef.current, enter.from, enter.to);
        }
      } else {
        const summary = getSessionSummary(nextState);
        await saveSession({
          setId,
          mode: 'flashcards',
          totalCards: summary.totalCards,
          correctCount: summary.correctCount,
          scorePercent: summary.scorePercent,
          weakWords: summary.weakWords,
        }, summary.results);
      }
    };

    if (cardContainerRef.current) {
      gsap.to(cardContainerRef.current, {
        ...ratingExitVars(isCorrect, window.innerWidth, prefersReducedMotion()),
        onComplete: proceed
      });
    } else {
      proceed();
    }
  }, [currentCard, startTime, queueState, setId, saveSession]);

  const handleLeaveForLater = useCallback(async () => {
    if (answeringRef.current || !canLeaveLater || !currentCard) return;
    answeringRef.current = true;
    const nextState = leaveCurrentForLater(queueState);
    setQueueState(nextState);

    const finishLeave = async () => {
      answeringRef.current = false;
      if (!nextState.isFinished) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        setStartTime(Date.now());
        if (cardContainerRef.current) {
          const enter = enterFromVars(1, 15);
          gsap.fromTo(cardContainerRef.current, enter.from, enter.to);
        }
      } else {
        const summary = getSessionSummary(nextState);
        await saveSession({
          setId,
          mode: 'flashcards',
          totalCards: summary.totalCards,
          correctCount: summary.correctCount,
          scorePercent: summary.scorePercent,
          weakWords: summary.weakWords,
        }, summary.results);
      }
    };

    if (cardContainerRef.current) {
      gsap.to(cardContainerRef.current, {
        ...ratingExitVars(false, window.innerWidth, prefersReducedMotion()),
        onComplete: finishLeave,
      });
    } else {
      finishLeave();
    }
  }, [canLeaveLater, currentCard, queueState, setId, saveSession]);

  const handlePrev = useCallback(() => {
    if (queueState.queue.length > 1 && !answeringRef.current) {
      const proceed = () => {
        // Rotacja kolejki w tył
        setQueueState(prev => {
          if (prev.queue.length <= 1) return prev;
          const last = prev.queue[prev.queue.length - 1];
          return { ...prev, queue: [last, ...prev.queue.slice(0, prev.queue.length - 1)] };
        });
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        
        if (cardContainerRef.current) {
          const enter = enterVars('prev');
          gsap.fromTo(cardContainerRef.current, enter.from, enter.to);
        }
      };
      
      if (cardContainerRef.current) {
        gsap.to(cardContainerRef.current, { ...exitVars('prev', window.innerWidth), onComplete: proceed });
      } else {
        proceed();
      }
    }
  }, [queueState.queue.length]);

  const handleNext = useCallback(() => {
    if (queueState.queue.length > 1 && !answeringRef.current) {
      const proceed = () => {
        // Rotacja kolejki w przód
        setQueueState(prev => {
          if (prev.queue.length <= 1) return prev;
          const [first, ...rest] = prev.queue;
          return { ...prev, queue: [...rest, first] };
        });
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        
        if (cardContainerRef.current) {
          const enter = enterVars('next');
          gsap.fromTo(cardContainerRef.current, enter.from, enter.to);
        }
      };

      if (cardContainerRef.current) {
        gsap.to(cardContainerRef.current, { ...exitVars('next', window.innerWidth), onComplete: proceed });
      } else {
        proceed();
      }
    }
  }, [queueState.queue.length]);

  // Przeciąganie karty: wspólny hook PointerEvents. Gest jest OCENĄ i działa tak samo na
  // awersie i rewersie: karta idzie za palcem 1:1 (gsap.set → translate3d, bez tweena na każdy
  // ruch), powyżej progu odlatuje w stronę ruchu (prawo „umiem", lewo „nie umiem"), poniżej
  // wraca sprężyście. Nawigacja bez oceny: przyciski „Poprzednia / Następna" i strzałki (klawiatura).
  const swipe = useRatingSwipe({
    cardRef: cardContainerRef,
    knowHintRef,
    dontKnowHintRef,
    isBusy: () => answeringRef.current,
    onRate: handleAnswer,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (queueState.isFinished) return;
      
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
  }, [isFlipped, queueState.isFinished, handleFlip, handleAnswer, handlePrev, handleNext]);

  if (cards.length === 0) return null;

  if (queueState.isFinished) {
    const summary = getSessionSummary(queueState);
    const correctCount = summary.correctCount;
    const totalCount = summary.totalCards;
    const score = summary.scorePercent;
    
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('flashcards.complete')}</h2>
        <Card className="py-12">
          <div className="text-6xl font-black text-primary mb-4">{Number.isNaN(Number(score)) ? 0 : score}%</div>
          <p className="text-xl text-content-muted">
            {t('flashcards.score').replace('{correct}', correctCount.toString()).replace('{total}', totalCount.toString())}
          </p>
        </Card>
        {onStartQuiz || onStartSentences ? (
          <WhatsNextSection
            weakWords={queueState.weakWords}
            onStartQuiz={() => onStartQuiz?.(queueState.weakWords)}
            onStartSentences={(format) => onStartSentences?.(format, queueState.weakWords)}
            onBack={onBack}
            onReplay={() => {
              const shuffled = [...initialCards].sort(() => Math.random() - 0.5);
              setCards(shuffled);
              setQueueState(createFlashcardQueue(shuffled));
              setIsFlipped(false);
            }}
          />
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
            <Button onClick={onBack} variant="secondary" className="flex-1">{t('flashcards.back')}</Button>
            <Button onClick={() => { if (onNavigate) onNavigate('ai-generator', { setId: setId, initialMode: 'flashcards', autoGenerate: true }); }} className="flex-1">
              {language === 'pl' ? 'Przećwicz w zdaniach' : 'Practice in sentences'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!currentCard) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <button onClick={() => { showConfirm(
            t('flashcards.confirmQuitTitle') || 'Zakończ', 
            t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?', 
            () => { closeConfirm(); onBack(); }
          ); }} className="text-content-muted hover:text-white flex items-center gap-2 pointer-coarse:min-h-11">
          
                            {i18n.t("&larr;")} {t('flashcards.quit')}
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsReversed(!isReversed)}
            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-text-2 pointer-coarse:min-h-11 pointer-coarse:px-3"
          >
            {isReversed ? 'PL -> EN' : 'EN -> PL'}
          </button>
          <div className="font-mono text-sm" data-testid="flashcard-counter">
            {/* `t` z LanguageContext przyjmuje tylko klucz (bez interpolacji) — liczby podstawia i18n.t. */}
            {i18n.t('Opanowano {{mastered}} z {{total}}', {
              mastered: queueState.masteredCount,
              total: queueState.initialTotal,
            })}
          </div>
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${queueState.initialTotal > 0 ? (queueState.masteredCount / queueState.initialTotal) * 100 : 0}%` }}
        />
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={handlePrev} 
          disabled={queueState.queue.length <= 1}
          className={`hidden md:flex p-4 rounded-full transition-colors ${queueState.queue.length <= 1 ? 'text-base-300 cursor-not-allowed' : 'text-content hover:bg-base-300'}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div className="flex-1 min-w-0">
          <div
            ref={cardContainerRef}
            data-testid="flashcard-stage"
            className={`relative w-full cursor-pointer will-change-transform ${SWIPE_TOUCH_ACTION_CLASS} perspective-1000`}
            onClick={() => {
              if (swipe.consumeSuppressedClick()) return;
              handleFlip();
            }}
            {...swipe.bind}
          >
            {/* Obie strony w JEDNEJ komórce siatki (a nie position:absolute): .liquid-glass-card
                ma `position: relative` poza warstwą Tailwinda i nadpisywał `absolute`, przez co
                tył karty lądował POD przodem i po obrocie nachodził na przyciski. Wysokość
                wyznacza wyższa ze stron, więc tekst nigdy nie wychodzi poza kartę. */}
            <motion.div
              key={currentIndex}
              data-testid="flashcard-flip"
              className="grid w-full preserve-3d"
              initial={false}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 200, damping: 20 }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Strony karty: wspólny komponent z rozgrzewką (FlashcardFace) */}
              <FlashcardFace
                side="front"
                label={t('flashcards.term')}
                html={currentCard.term}
                actions={<>
                  <PronunciationMic targetWord={currentCard.term.replace(/<[^>]+>/g, '')} />
                  <TTSButtons text={currentCard.term} />
                </>}
              />
              <FlashcardFace
                side="back"
                label={t('flashcards.definition')}
                html={currentCard.definition}
                actions={<TTSButtons text={currentCard.definition} />}
              />
            </motion.div>
            <SwipeRatingHint knowRef={knowHintRef} dontKnowRef={dontKnowHintRef} />
          </div>
        </div>

        <button 
          onClick={handleNext} 
          disabled={queueState.queue.length <= 1}
          className={`hidden md:flex p-4 rounded-full transition-colors ${queueState.queue.length <= 1 ? 'text-base-300 cursor-not-allowed' : 'text-content hover:bg-base-300'}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <div className="flex justify-between md:hidden px-4">
         <button onClick={handlePrev} disabled={queueState.queue.length <= 1} className={`p-2 pointer-coarse:min-h-11 pointer-coarse:px-3 ${queueState.queue.length <= 1 ? 'opacity-30' : ''}`}>← {language === 'pl' ? 'Poprzednia' : 'Previous'}</button>
         <button onClick={handleNext} disabled={queueState.queue.length <= 1} className={`p-2 pointer-coarse:min-h-11 pointer-coarse:px-3 ${queueState.queue.length <= 1 ? 'opacity-30' : ''}`}>{language === 'pl' ? 'Następna' : 'Next'} →</button>
      </div>

      {isFlipped ? (
        <div className="grid grid-cols-2 gap-4 mt-2" data-testid="flashcard-actions">
          <Button variant="danger" className="py-4 text-lg flex flex-col items-center justify-center gap-1" onClick={() => handleAnswer(false)}>
            {/* Czerwony tekst na czerwonawym tle: 4,05:1 w trybie jasnym. Stan niesie obwódka i tło
                przycisku, tekst idzie tokenem `text-hi` (patrz tests/flashcardRatingContrast.test.ts). */}
            <span className="text-text-hi">{i18n.t("Nie umiem")}</span>
            <span className="text-[12px] uppercase text-text-hi">{i18n.t("Nie umiem (Strzałka w lewo)")}</span>
          </Button>
          <Button className="py-4 text-lg flex flex-col items-center justify-center gap-1" onClick={() => handleAnswer(true)}>
            <span>{i18n.t("Umiem")}</span>
            <span className="text-[12px] uppercase">{i18n.t("Umiem (Strzałka w prawo)")}</span>
          </Button>
        </div>
      ) : (
        <div className="text-center text-content-muted text-sm animate-pulse mt-2 flex flex-col items-center gap-2" data-testid="flashcard-actions">
          <span>{t('flashcards.clickReveal')}</span>
          <span className="bg-base-300 px-2 py-1 rounded text-xs">{i18n.t("Spacja")}</span>
        </div>
      )}

      {canLeaveLater && (
        <div className="flex flex-col items-center gap-1.5 pt-2 text-center">
          <p className="text-xs text-text-3">
            {t('Trudna karta — możesz zostawić ją na później')}
          </p>
          <button
            type="button"
            data-testid="flashcard-leave-later"
            onClick={handleLeaveForLater}
            className="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-xl border border-line-strong bg-base-200/80 hover:bg-base-200 text-text-2 hover:text-text-hi text-sm font-semibold transition-colors cursor-pointer"
          >
            {t('Zostaw na później')}
          </button>
        </div>
      )}
    </div>
  );
};

// --- Quiz Mode Component ---
const QuizMode = ({ cards: initialCards, setId, onBack, saveSession, t, showConfirm, closeConfirm , onNavigate, language, focusWords}: any) => {
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
    if (Array.isArray(focusWords) && focusWords.length > 0) {
      const focusSet = new Set(focusWords.map((w: string) => (w || '').trim().toLowerCase()));
      const weak = shuffled.filter((c: Flashcard) => focusSet.has((c.term || '').trim().toLowerCase()));
      const others = shuffled.filter((c: Flashcard) => !focusSet.has((c.term || '').trim().toLowerCase()));
      setCards([...weak, ...others]);
    } else {
      setCards(shuffled);
    }
    setStartTime(Date.now());
  }, [initialCards, focusWords]);

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
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-5 sm:gap-8 px-4 sm:px-0 pb-4 max-md:flex-1">
      <div className="flex items-center justify-between">
        <button onClick={() => { showConfirm(
            t('flashcards.confirmQuitTitle') || 'Zakończ', 
            t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?', 
            () => { closeConfirm(); onBack(); }
          ); }} className="text-content-muted hover:text-white flex items-center gap-2 pointer-coarse:min-h-11">
          
                            {i18n.t("&larr;")} {t('flashcards.quit')}
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsReversed(!isReversed)}
            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-text-2 pointer-coarse:min-h-11 pointer-coarse:px-3"
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

      {/* Na telefonie karta zaczyna treść pod rzędem przycisków wymowy (pt-16), żeby etykieta
          i fraza nie nachodziły na mikrofon i UK/US. */}
      <Card className="relative flex flex-col items-center justify-center text-center px-5 pb-8 pt-16 sm:p-12 border border-white/10 min-h-[200px]">
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex gap-2">
          <PronunciationMic targetWord={currentCard?.term.replace(/<[^>]+>/g, '') || ''} />
          {currentCard?.term && <TTSButtons text={currentCard.term} />}
        </div>
        <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-4 sm:mb-8">{t('flashcards.term')}</div>
        <div className="text-3xl sm:text-4xl md:text-5xl font-bold break-words max-w-full" dangerouslySetInnerHTML={{ __html: currentCard?.term || '' }} />
      </Card>

      {/* Odpowiedzi na dole (`mt-auto` na telefonie): w zasięgu kciuka, nad dolną krawędzią. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-md:mt-auto" role="group" aria-label={t('flashcards.definition')}>
        {options.map((option, i) => (
          <QuizOption
            key={i}
            html={option}
            state={quizOptionState(
              selectedOption === null ? 'answering' : 'answered',
              option === currentCard.definition,
              option === selectedOption,
            )}
            onSelect={() => handleAnswer(option)}
          />
        ))}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {selectedOption === null
          ? ''
          : isCorrect
            ? i18n.t('Poprawnie')
            : `${i18n.t('Niepoprawnie')}. ${i18n.t('Poprawna odpowiedź')}: ${stripHtml(currentCard.definition)}`}
      </p>
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
          ); }} className="text-content-muted hover:text-white flex items-center gap-2 pointer-coarse:min-h-11">
          
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
// Gra żyje w MatchingGame (plansza tasowana raz na rundę, efekty GSAP, gwiazdki);
// tu zostaje tylko zapis sesji — dokładnie to, co zapisywała dotąd.
const MatchingMode = ({ cards, setId, onBack, saveSession, t, showConfirm, closeConfirm , onNavigate, language, onComplete}: any) => (
  <div className="w-full flex-1 flex flex-col min-h-[calc(100dvh-5rem)]">
    <MatchingGame
      cards={cards}
      onBack={onBack}
      onQuit={() => showConfirm(
        t('flashcards.confirmQuitTitle') || (language === 'pl' ? 'Zakończ Sesję' : 'Quit Session'),
        t('flashcards.confirmQuit') || (language === 'pl' ? 'Czy na pewno chcesz zakończyć sesję?' : 'Are you sure you want to quit the session?'),
        () => { closeConfirm(); onBack(); }
      )}
      onFinish={async (r) => {
        await saveSession({
          setId,
          mode: 'matching',
          totalCards: r.pairs,
          correctCount: r.pairs,
          scorePercent: r.score
        }, r.wrongWords || []);
        if (onComplete) {
          onComplete(r.wrongWords || []);
        }
      }}
      onPracticeSentences={onNavigate ? () => onNavigate('ai-generator', { setId: setId, initialMode: 'flashcards', autoGenerate: true }) : undefined}
    />
  </div>
);

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
          ); }} className="text-content-muted hover:text-white flex items-center gap-2 pointer-coarse:min-h-11">
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
        className="relative w-full aspect-[3/2] min-h-[220px] perspective-1000 cursor-pointer"
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
