import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, History, CheckCircle2, ShoppingBasket, Puzzle } from 'lucide-react';

interface OnboardingOverlayProps {
  onComplete: () => void;
  language: 'pl' | 'en';
}

const steps = [
  {
    icon: <Puzzle className="w-10 h-10 text-primary" />,
    title: { pl: 'Rozpocznij od Układanki', en: 'Start with the Puzzle' },
    desc: { 
      pl: 'Sugerujemy, aby najpierw wykonać zadanie „układanka”. Pozwala to w łatwy sposób poznać strukturę, z którego następnie przejdziesz do samodzielnego tłumaczenia tych zdań.',
      en: 'We recommend starting with the "puzzle" task to learn the structure, and then move on to translating the sentences yourself.'
    }
  },
  {
    icon: <ShoppingBasket className="w-10 h-10 text-purple-400" />,
    title: { pl: 'Twój Koszyk Słówek', en: 'Your Vocabulary Basket' },
    desc: {
      pl: 'Dodawaj do koszyka dowolne słowa z lekcji lub własne pojęcia. Z zebranych w koszyku słów możesz jednym kliknięciem wygenerować spersonalizowane ćwiczenia.',
      en: 'Add any words from lessons or your own concepts to the basket. You can generate personalized exercises from the collected words with one click.'
    }
  },
  {
    icon: <History className="w-10 h-10 text-blue-400" />,
    title: { pl: 'Historia Sesji i Lekcji', en: 'Session & Lesson History' },
    desc: {
      pl: 'Zawsze możesz wrócić do przeszłości. W zakładkach historii sprawdzisz odbyte do tej pory zajęcia, prześledzisz swoje błędy i zobaczysz, jak bardzo się rozwijasz.',
      en: 'You can always look back. In the history tabs, you can check past classes, track your mistakes, and see your progress.'
    }
  }
];

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete, language }) => {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -20 }}
          className="max-w-md w-full bg-base-200 border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-purple-500 to-blue-500" />
          
          <div className="flex flex-col items-center text-center space-y-6 mt-4">
            <div className="p-5 bg-white/5 rounded-3xl shadow-inner border border-white/5">
              {steps[currentStep].icon}
            </div>
            
            <div className="space-y-3">
              <h3 className="text-2xl font-bold font-display tracking-tight text-white">
                {steps[currentStep].title[language]}
              </h3>
              <p className="text-content-muted text-base leading-relaxed">
                {steps[currentStep].desc[language]}
              </p>
            </div>

            <div className="flex gap-2 py-6">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-primary' : 'bg-white/20'}`} 
                />
              ))}
            </div>

            <button
              onClick={() => {
                if (currentStep < steps.length - 1) {
                  setCurrentStep(c => c + 1);
                } else {
                  onComplete();
                }
              }}
              className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95"
            >
              {currentStep < steps.length - 1 ? (
                language === 'pl' ? 'Dalej' : 'Next'
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  {language === 'pl' ? 'Rozumiem, zaczynamy!' : "Got it, let's start!"}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OnboardingOverlay;
