import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, History, CheckCircle2 } from 'lucide-react';

interface OnboardingOverlayProps {
  onComplete: () => void;
  language: 'pl' | 'en';
}

const steps = [
  {
    icon: <Sparkles className="w-8 h-8 text-primary" />,
    title: { pl: 'Generator AI', en: 'AI Generator' },
    desc: { 
      pl: 'W panelu ćwiczeniowym wygenerujesz ćwiczenia językowe, dostosowane do Twojego poziomu i celów.',
      en: 'In the practice panel you can generate language exercises tailored to your level and goals.'
    }
  },
  {
    icon: <Brain className="w-8 h-8 text-purple-400" />,
    title: { pl: 'Twoje Słownictwo', en: 'Your Vocabulary' },
    desc: {
      pl: 'W zakładce Słownictwo znajdziesz wszystkie zapisane zestawy, fiszki i słówka do nauki.',
      en: 'In the Vocabulary tab, you will find all your saved sets, flashcards, and words to learn.'
    }
  },
  {
    icon: <History className="w-8 h-8 text-blue-400" />,
    title: { pl: 'Historia Sesji', en: 'Session History' },
    desc: {
      pl: 'Śledź swoje postępy i przeglądaj wykonane ćwiczenia w Historii, by szybciej osiągnąć sukces.',
      en: 'Track your progress and review completed exercises in History to achieve success faster.'
    }
  }
];

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete, language }) => {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -20 }}
          className="max-w-md w-full bg-base-200 border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-blue-500" />
          
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-white/5 rounded-2xl">
              {steps[currentStep].icon}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold font-display">
                {steps[currentStep].title[language]}
              </h3>
              <p className="text-content-muted text-base leading-relaxed">
                {steps[currentStep].desc[language]}
              </p>
            </div>

            <div className="flex gap-2 py-4">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-primary' : 'bg-white/20'}`} 
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
              className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {currentStep < steps.length - 1 ? (
                language === 'pl' ? 'Dalej' : 'Next'
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  {language === 'pl' ? 'Zaczynamy!' : "Let's Start!"}
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
