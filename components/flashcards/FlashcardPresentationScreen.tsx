import React, { useState, useEffect, useCallback } from 'react';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import { Flashcard } from '../../types';
import Button from '../ui/Button';

interface FlashcardPresentationScreenProps {
  setId: string;
  onBack: () => void;
}

const FlashcardPresentationScreen: React.FC<FlashcardPresentationScreenProps> = ({ setId, onBack }) => {
  const { getFlashcards, sets } = useFlashcards();
  const { language } = useLanguage();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // 0: Initial, 1: Translation Revealed, 2: Context Revealed
  const [step, setStep] = useState<0 | 1 | 2>(0);
  
  // 'term-first' (e.g. English first), 'def-first' (e.g. Polish first - default)
  const [mode, setMode] = useState<'term-first' | 'def-first'>('def-first');

  const currentSet = sets.find(s => s.id === setId);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const fetchedCards = await getFlashcards(setId);
        // Sort by position
        fetchedCards.sort((a, b) => a.position - b.position);
        setCards(fetchedCards);
      } catch (error) {
        console.error('Failed to load flashcards:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCards();
  }, [setId, getFlashcards]);

  const handleNextStep = useCallback(() => {
    if (step === 0) setStep(1);
    else if (step === 1) setStep(2);
  }, [step]);

  const handleNextCard = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setStep(0);
    }
  }, [currentIndex, cards.length]);

  const handlePrevCard = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setStep(0);
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        if (step < 2) handleNextStep();
        else handleNextCard();
      } else if (e.key === 'ArrowLeft') {
        handlePrevCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, handleNextStep, handleNextCard, handlePrevCard, onBack]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-base-100">
        <h2 className="text-2xl font-bold mb-4">{language === 'pl' ? 'Ten zestaw nie ma słówek.' : 'This set has no words.'}</h2>
        <Button onClick={onBack}>{language === 'pl' ? 'Wróć' : 'Back'}</Button>
      </div>
    );
  }

  const card = cards[currentIndex];
  
  const frontContent = mode === 'def-first' ? card.definition : card.term;
  const backContent = mode === 'def-first' ? card.term : card.definition;

  return (
    <div className="fixed inset-0 z-50 bg-base-100 flex flex-col h-screen w-screen overflow-hidden text-content">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 bg-base-200/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center hover:bg-base-300/80 hover:text-white transition-colors"
          >
            ✕
          </button>
          <div>
            <h1 className="font-bold text-lg">{currentSet?.title}</h1>
            <p className="text-xs text-content-muted">{currentIndex + 1} / {cards.length}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-base-300 rounded-lg p-1">
          <button 
            onClick={() => { setMode('def-first'); setStep(0); }}
            className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${mode === 'def-first' ? 'bg-primary text-black' : 'text-content-muted hover:text-white'}`}
          >
            {language === 'pl' ? 'Najpierw PL/Definicja' : 'Def First'}
          </button>
          <button 
            onClick={() => { setMode('term-first'); setStep(0); }}
            className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${mode === 'term-first' ? 'bg-primary text-black' : 'text-content-muted hover:text-white'}`}
          >
            {language === 'pl' ? 'Najpierw EN/Pojęcie' : 'Term First'}
          </button>
        </div>
      </div>

      {/* Main Slide Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-base-100 to-base-200/50">
        
        {/* Main Word/Phrase */}
        <div className="w-full max-w-4xl min-h-[40vh] flex flex-col items-center justify-center gap-8 relative p-12">
          
          <div 
            className="text-center font-display font-black text-5xl md:text-7xl text-white tracking-tight"
            dangerouslySetInnerHTML={{ __html: frontContent }}
          />
          
          {/* Back Content (Translation) */}
          <div className={`transition-all duration-700 ease-out transform ${step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}>
            <div 
              className="text-center font-display font-medium text-3xl md:text-4xl text-primary"
              dangerouslySetInnerHTML={{ __html: backContent }}
            />
          </div>

        </div>

        {/* Context Sentence */}
        <div className={`w-full max-w-3xl mt-4 px-8 py-6 rounded-2xl bg-base-200/40 backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-700 ease-out transform ${step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}>
          <div className="text-xl md:text-2xl font-serif italic text-white/90 text-center leading-relaxed mb-4">
            {card.contextSentence ? (
              <span dangerouslySetInnerHTML={{ __html: card.contextSentence }} />
            ) : (
              <span className="text-content-muted not-italic uppercase tracking-wider text-sm font-sans font-bold">
                {language === 'pl' ? 'Brak zapisanego zdania w kontekście.' : 'No context sentence provided.'}
              </span>
            )}
          </div>
          {card.contextTranslation && (
            <div className="text-lg md:text-xl font-medium text-primary/80 text-center">
              <span dangerouslySetInnerHTML={{ __html: card.contextTranslation }} />
            </div>
          )}
        </div>

      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between p-6 bg-base-100 border-t border-white/5">
        <Button 
          variant="secondary" 
          onClick={handlePrevCard} 
          disabled={currentIndex === 0}
          className="w-32"
        >
          {language === 'pl' ? 'Poprzednie' : 'Previous'}
        </Button>
        
        <div className="text-sm font-mono text-content-muted">
          {step === 0 && (language === 'pl' ? 'Kliknij "Dalej", by zobaczyć tłumaczenie' : 'Click "Next" to reveal translation')}
          {step === 1 && (language === 'pl' ? 'Kliknij "Dalej", by zobaczyć kontekst' : 'Click "Next" to reveal context')}
          {step === 2 && (language === 'pl' ? 'Kliknij "Dalej", by przejść do następnego słowa' : 'Click "Next" for the next word')}
        </div>

        <Button 
          onClick={() => {
            if (step < 2) handleNextStep();
            else handleNextCard();
          }}
          className="w-32 text-black font-bold shadow-[0_0_15px_rgba(74,222,128,0.3)]"
          disabled={step === 2 && currentIndex === cards.length - 1}
        >
          {language === 'pl' ? 'Dalej' : 'Next'}
        </Button>
      </div>
    </div>
  );
};

export default FlashcardPresentationScreen;
