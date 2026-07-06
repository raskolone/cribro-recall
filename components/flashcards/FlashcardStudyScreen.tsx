import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Flashcard, FlashcardSet } from '../../types';
import PronunciationMic from '../ui/PronunciationMic';
import TTSButtons from './TTSButtons';

interface FlashcardStudyScreenProps {
  setId: string;
  initialMode?: StudyMode;
  onBack: () => void;
  onStartAIPractice?: () => void;
}

type StudyMode = 'flashcards' | 'quiz' | 'writing' | 'matching' | 'intro' | null;

const FlashcardStudyScreen: React.FC<FlashcardStudyScreenProps> = ({ setId, initialMode = null, onBack, onStartAIPractice }) => {
  const { sets, getFlashcards, saveSession } = useFlashcards();
  const { t, language } = useLanguage();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<StudyMode>(initialMode || null);

  useEffect(() => {
    const currentSet = sets.find(s => s.id === setId);
    if (currentSet) {
      setSet(currentSet);
    }
    
    const loadCards = async () => {
      const loadedCards = await getFlashcards(setId);
      setCards(loadedCards);
      setIsLoading(false);
    };
    
    loadCards();
  }, [setId, sets, getFlashcards]);

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (cards.length === 0) {
    return (
      <div className="text-center space-y-4">
        <p>{t('flashcards.emptySet')}</p>
        <Button onClick={onBack}>{t('flashcards.back')}</Button>
      </div>
    );
  }

  if (!selectedMode) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-content-muted hover:text-white flex items-center gap-2">
            &larr; {language === 'pl' ? 'Wróć do zestawu' : 'Back to set'}
          </button>
          <h2 className="text-2xl font-bold">{set?.title}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {onStartAIPractice && (
            <Card 
              className="cursor-pointer hover:border-primary transition-colors group relative overflow-hidden"
              onClick={onStartAIPractice}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="text-4xl mb-4 relative z-10">✨</div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors relative z-10">
                {language === 'pl' ? 'Tłumacz z AI' : 'Translate with AI'}
              </h3>
              <p className="text-content-muted text-sm relative z-10">
                {language === 'pl' ? 'Ćwicz tłumaczenie całych zdań z użyciem tego słownictwa, wspierany przez AI.' : 'Practice translating full sentences using this vocabulary, powered by AI.'}
              </p>
            </Card>
          )}

          <Card 
            className="cursor-pointer hover:border-primary transition-colors group"
            onClick={() => setSelectedMode('intro')}
          >
            <div className="text-4xl mb-4">👀</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
              {language === 'pl' ? 'Fiszki Intro' : 'Flashcards Intro'}
            </h3>
            <p className="text-content-muted text-sm">
              {language === 'pl' ? 'Zapoznaj się powoli z nowym materiałem, bez sprawdzania i wyników.' : 'Familiarize yourself gently with new material, without testing or scoring.'}
            </p>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors group"
            onClick={() => setSelectedMode('flashcards')}
          >
            <div className="text-4xl mb-4">🎴</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
              {language === 'pl' ? 'Fiszki' : 'Flashcards'}
            </h3>
            <p className="text-content-muted text-sm">
              {language === 'pl' ? 'Przeglądaj pojęcia i definicje. Odwracaj karty, aby sprawdzić swoją wiedzę.' : 'Review terms and definitions. Flip cards to test your knowledge.'}
            </p>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors group"
            onClick={() => setSelectedMode('quiz')}
          >
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
              {language === 'pl' ? 'Quiz' : 'Quiz'}
            </h3>
            <p className="text-content-muted text-sm">
              {language === 'pl' ? 'Wybierz poprawną odpowiedź z 4 dostępnych opcji.' : 'Choose the correct answer from 4 available options.'}
            </p>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors group"
            onClick={() => setSelectedMode('writing')}
          >
            <div className="text-4xl mb-4">⌨️</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
              {language === 'pl' ? 'Pisanie' : 'Writing'}
            </h3>
            <p className="text-content-muted text-sm">
              {language === 'pl' ? 'Wpisz poprawną definicję z klawiatury.' : 'Type the correct definition from your keyboard.'}
            </p>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors group"
            onClick={() => setSelectedMode('matching')}
          >
            <div className="text-4xl mb-4">🧩</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
              {language === 'pl' ? 'Dopasowywanie' : 'Matching'}
            </h3>
            <p className="text-content-muted text-sm">
              {language === 'pl' ? 'Połącz pojęcia z definicjami na czas.' : 'Match terms with definitions against the clock.'}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (selectedMode === 'intro') {
    return <IntroMode cards={cards} onBack={() => setSelectedMode(null)} t={t} />;
  }

  if (selectedMode === 'quiz') {
    return <QuizMode cards={cards} setId={setId} onBack={() => setSelectedMode(null)} saveSession={saveSession} t={t} />;
  }

  if (selectedMode === 'writing') {
    return <WritingMode cards={cards} setId={setId} onBack={() => setSelectedMode(null)} saveSession={saveSession} t={t} />;
  }

  if (selectedMode === 'matching') {
    return <MatchingMode cards={cards} setId={setId} onBack={() => setSelectedMode(null)} saveSession={saveSession} t={t} />;
  }

  return (
    <FlashcardsMode 
      cards={cards} 
      setId={setId} 
      onBack={() => setSelectedMode(null)} 
      saveSession={saveSession}
      t={t}
    />
  );
};

// --- Flashcards Mode Component ---
const FlashcardsMode = ({ cards: initialCards, setId, onBack, saveSession, t }: any) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<{ flashcardId: string; isCorrect: boolean; responseTimeMs: number }[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const shuffled = [...initialCards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setStartTime(Date.now());
  }, [initialCards]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

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
          scorePercent: Math.round((correctCount / cards.length) * 100)
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
    const score = Math.round((correctCount / cards.length) * 100);
    
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('flashcards.complete')}</h2>
        <Card className="py-12">
          <div className="text-6xl font-black text-primary mb-4">{score}%</div>
          <p className="text-xl text-content-muted">
            {t('flashcards.score').replace('{correct}', correctCount.toString()).replace('{total}', cards.length.toString())}
          </p>
        </Card>
        <Button onClick={onBack} className="w-full">{t('flashcards.back')}</Button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { if (window.confirm(t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?')) onBack(); }} className="text-content-muted hover:text-white flex items-center gap-2">
          &larr; {t('flashcards.quit')}
        </button>
        <div className="font-mono text-sm">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
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
              className="relative w-full aspect-[3/2] cursor-pointer"
              onClick={handleFlip}
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
                    {/* Definition might not be strictly English, but we can allow TTS for it as well if it's the target language. But usually it's native. We omit it here or keep it. Let's just remove audioUrl button for now. */}
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
         <button onClick={handlePrev} disabled={currentIndex === 0} className={`p-2 ${currentIndex === 0 ? 'opacity-30' : ''}`}>&larr; Poprzednia</button>
         <button onClick={handleNext} disabled={currentIndex === cards.length - 1} className={`p-2 ${currentIndex === cards.length - 1 ? 'opacity-30' : ''}`}>Następna &rarr;</button>
      </div>

      {isFlipped ? (
        <div className="grid grid-cols-2 gap-4 mt-8">
          <Button variant="danger" className="py-4 text-lg flex flex-col items-center justify-center gap-1" onClick={() => handleAnswer(false)}>
            <span>Umiem</span>
            <span className="text-[10px] uppercase opacity-70">Nie umiem (Strzałka w lewo)</span>
          </Button>
          <Button className="py-4 text-lg flex flex-col items-center justify-center gap-1" onClick={() => handleAnswer(true)}>
            <span>Umiem</span>
            <span className="text-[10px] uppercase opacity-70">Umiem (Strzałka w prawo)</span>
          </Button>
        </div>
      ) : (
        <div className="text-center text-content-muted text-sm animate-pulse mt-8 flex flex-col items-center gap-2">
          <span>{t('flashcards.clickReveal')}</span>
          <span className="bg-base-300 px-2 py-1 rounded text-xs">Spacja</span>
        </div>
      )}
    </div>
  );
};

// --- Quiz Mode Component ---
const QuizMode = ({ cards: initialCards, setId, onBack, saveSession, t }: any) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState<{ flashcardId: string; isCorrect: boolean; responseTimeMs: number }[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [isFinished, setIsFinished] = useState(false);

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
          scorePercent: Math.round((correctCount / cards.length) * 100)
        }, newResults);
      }
    }, correct ? 1000 : 2000); // Wait longer if wrong to show correct answer
  };

  if (cards.length === 0) return null;

  if (isFinished) {
    const correctCount = results.filter(r => r.isCorrect).length;
    const score = Math.round((correctCount / cards.length) * 100);
    
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('flashcards.complete')}</h2>
        <Card className="py-12">
          <div className="text-6xl font-black text-primary mb-4">{score}%</div>
          <p className="text-xl text-content-muted">
            {t('flashcards.score').replace('{correct}', correctCount.toString()).replace('{total}', cards.length.toString())}
          </p>
        </Card>
        <Button onClick={onBack} className="w-full">{t('flashcards.back')}</Button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { if (window.confirm(t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?')) onBack(); }} className="text-content-muted hover:text-white flex items-center gap-2">
          &larr; {t('flashcards.quit')}
        </button>
        <div className="font-mono text-sm">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
        />
      </div>

      <Card className="relative flex flex-col items-center justify-center text-center p-12 border border-white/10 min-h-[200px]">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <PronunciationMic targetWord={currentCard?.term.replace(/<[^>]+>/g, '') || ''} />
          {currentCard?.audioUrl && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const audio = new Audio(currentCard.audioUrl!);
                audio.play();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-base-300 text-primary hover:bg-base-100 border border-base-300 transition-colors"
              title="Play audio"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          )}
        </div>
        <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{t('flashcards.term')}</div>
        <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard?.term || '' }} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, i) => {
          let btnClass = "py-6 text-lg h-auto whitespace-normal break-words";
          if (selectedOption !== null) {
            if (option === currentCard.definition) {
              btnClass += " bg-green-500/20 border-green-500 text-green-400";
            } else if (option === selectedOption) {
              btnClass += " bg-red-500/20 border-red-500 text-red-400";
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

const WritingMode = ({ cards: initialCards, setId, onBack, saveSession, t }: any) => {
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
          scorePercent: Math.round((correctCount / cards.length) * 100)
        }, newResults);
      }
    }, isCorrect ? 1000 : 3000); // Wait longer if wrong to show correct answer
  };

  if (cards.length === 0) return null;

  if (isFinished) {
    const correctCount = results.filter(r => r.isCorrect).length;
    const score = Math.round((correctCount / cards.length) * 100);
    
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('flashcards.complete')}</h2>
        <Card className="py-12">
          <div className="text-6xl font-black text-primary mb-4">{score}%</div>
          <p className="text-xl text-content-muted">
            {t('flashcards.score').replace('{correct}', correctCount.toString()).replace('{total}', cards.length.toString())}
          </p>
        </Card>
        <Button onClick={onBack} className="w-full">{t('flashcards.back')}</Button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { if (window.confirm(t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?')) onBack(); }} className="text-content-muted hover:text-white flex items-center gap-2">
          &larr; {t('flashcards.quit')}
        </button>
        <div className="font-mono text-sm">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
        />
      </div>

      <Card className="relative flex flex-col items-center justify-center text-center p-12 border border-white/10 min-h-[200px]">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <PronunciationMic targetWord={currentCard?.term.replace(/<[^>]+>/g, '') || ''} />
          {currentCard?.audioUrl && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const audio = new Audio(currentCard.audioUrl!);
                audio.play();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-base-300 text-primary hover:bg-base-100 border border-base-300 transition-colors"
              title="Play audio"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          )}
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
              status === 'correct' ? 'border-green-500 text-green-400' :
              status === 'incorrect' ? 'border-red-500 text-red-400' :
              'border-base-300 focus:border-primary'
            }`}
            placeholder="Type the definition..."
          />
        </div>
        
        {status === 'incorrect' && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
            <div className="text-sm text-red-400 mb-1">Correct answer:</div>
            <div className="text-xl font-bold text-white" dangerouslySetInnerHTML={{ __html: currentCard?.definition || '' }} />
          </div>
        )}
        
        {status === 'typing' && (
          <Button type="submit" className="w-full py-4 text-lg" disabled={!input.trim()}>
            Submit
          </Button>
        )}
      </form>
    </div>
  );
};

// --- Matching Mode Component ---
const MatchingMode = ({ cards: initialCards, setId, onBack, saveSession, t }: any) => {
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
          <div className="text-6xl font-black text-primary mb-4">{timeScore} pts</div>
          <p className="text-xl text-content-muted mb-2">
            Time: {elapsedTime}s
          </p>
          <p className="text-xl text-content-muted">
            Mistakes: {mistakes}
          </p>
        </Card>
        <Button onClick={onBack} className="w-full">{t('flashcards.back')}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => { if (window.confirm(t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?')) onBack(); }} className="text-content-muted hover:text-white flex items-center gap-2">
          &larr; {t('flashcards.quit')}
        </button>
        <div className="font-mono text-xl font-bold">
          {elapsedTime}s
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((item) => {
          if (item.isMatched) {
            return (
              <div key={item.id} className="h-32 rounded-xl border-2 border-dashed border-green-500/30 bg-green-500/5 opacity-50 transition-all duration-500" />
            );
          }
          
          const isSelected = selectedId === item.id;
          const isWrong = wrongPair?.includes(item.id);
          
          return (
            <Card 
              key={item.id}
              className={`h-32 flex items-center justify-center text-center cursor-pointer transition-all duration-200 select-none ${
                isSelected ? 'border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20' : 
                isWrong ? 'border-red-500 bg-red-500/10 animate-shake' : 
                'hover:border-base-300 hover:bg-base-200/50'
              }`}
              onClick={() => handleItemClick(item)}
            >
              <span className="font-medium text-lg" dangerouslySetInnerHTML={{ __html: item.text }} />
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// --- Intro Mode Component ---
const IntroMode = ({ cards, onBack, t }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

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
        <button onClick={() => { if (window.confirm(t('flashcards.confirmQuit') || 'Czy na pewno chcesz zakończyć sesję?')) onBack(); }} className="text-content-muted hover:text-white flex items-center gap-2">
          &larr; {t('flashcards.quit')}
        </button>
        <div className="font-mono text-sm">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-secondary h-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      <div 
        className="relative w-full aspect-[3/2] perspective-1000 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-white/10 hover:border-secondary/50 transition-colors">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <PronunciationMic targetWord={currentCard.term.replace(/<[^>]+>/g, '')} />
              {currentCard.audioUrl && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const audio = new Audio(currentCard.audioUrl!);
                    audio.play();
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-base-300 text-secondary hover:bg-base-100 border border-base-300 transition-colors"
                  title="Play audio"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
              )}
            </div>
            <div className="text-sm font-mono text-content-muted uppercase tracking-widest mb-8">{t('flashcards.term')}</div>
            <div className="text-4xl md:text-5xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.term }} />
          </Card>
          
          <Card className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center text-center p-8 border border-secondary/50 rotate-y-180">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              {currentCard.audioUrl && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const audio = new Audio(currentCard.audioUrl!);
                    audio.play();
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-base-100 text-secondary hover:bg-base-300 border border-base-300 transition-colors"
                  title="Play audio"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
              )}
            </div>
            <div className="text-sm font-mono text-secondary uppercase tracking-widest mb-8">{t('flashcards.definition')}</div>
            <div className="text-3xl md:text-4xl font-bold" dangerouslySetInnerHTML={{ __html: currentCard.definition }} />
          </Card>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={handlePrev} disabled={currentIndex === 0}>
          &larr; Previous
        </Button>
        <Button onClick={handleNext}>
          {currentIndex === cards.length - 1 ? 'Finish' : 'Next \u2192'}
        </Button>
      </div>
    </div>
  );
};

export default FlashcardStudyScreen;
