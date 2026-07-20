import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Button from '../ui/Button';

interface Step {
  targetId: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

const steps: Step[] = [
  {
    targetId: 'tour-generator',
    title: 'Generowanie ćwiczeń',
    content: 'Tutaj znajduje się Twoje główne centrum dowodzenia. AI dopasuje zdania do Twojego profilu i poziomu.',
    placement: 'right'
  },
  {
    targetId: 'tour-flashcards',
    title: 'Słownictwo',
    content: 'W tym miejscu znajdziesz swoje słówka z lekcji oraz stworzysz własne fiszki do nauki.',
    placement: 'right'
  },
  {
    targetId: 'tour-history',
    title: 'Historia sesji',
    content: 'Możesz tu śledzić swój postęp i powracać do materiałów z poprzednich lekcji.',
    placement: 'right'
  }
];

export const OnboardingTour: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      const el = document.getElementById(steps[currentStep].targetId);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    // Slight delay to allow DOM render
    const t = setTimeout(updateRect, 500);
    return () => {
      window.removeEventListener('resize', updateRect);
      clearTimeout(t);
    };
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onComplete();
    }
  };

  if (!targetRect) return null;

  const step = steps[currentStep];

  let top = 0;
  let left = 0;

  if (step.placement === 'right') {
    top = targetRect.top + targetRect.height / 2;
    left = targetRect.right + 20;
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dimmed background */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto transition-opacity duration-300" />
      
      {/* Highlight ring around target */}
      <div 
        className="absolute border-2 border-primary rounded-xl pointer-events-none transition-all duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.4), 0 0 20px rgba(114,240,180,0.5)'
        }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute w-72 bg-base-300 border border-primary/30 p-5 rounded-2xl shadow-2xl pointer-events-auto"
          style={{
            top: top - 40,
            left: left
          }}
        >
          <div className="absolute top-10 -left-2 w-4 h-4 bg-base-300 border-l border-b border-primary/30 transform rotate-45" />
          
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Krok {currentStep + 1} z {steps.length}</span>
            <button onClick={onComplete} className="text-xs text-content-muted hover:text-white transition-colors">Pomiń</button>
          </div>
          
          <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
          <p className="text-sm text-content-muted mb-4">{step.content}</p>
          
          <div className="flex justify-end">
            <Button onClick={handleNext} className="py-2 px-4 text-sm font-bold shadow-lg">
              {currentStep < steps.length - 1 ? 'Dalej' : 'Zakończ'}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
