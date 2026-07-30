import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BookOpen, ArrowRight, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface NewVocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewHistory: () => void;
}

const NewVocabularyModal: React.FC<NewVocabularyModalProps> = ({
  isOpen,
  onClose,
  onViewHistory
}) => {
  const { language } = useLanguage();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-[#0c121e] border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(16,185,129,0.35)] text-center overflow-hidden"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button Top Right */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon Badge */}
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Sparkles className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
            </span>
          </div>

          {/* Badge Label */}
          <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 mb-3 tracking-wider uppercase">
            {language === 'pl' ? 'Nowa Lekcja & Słownictwo' : 'New Lesson & Vocabulary'}
          </span>

          {/* Main Title */}
          <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-white mb-3">
            {language === 'pl' ? 'Masz nowe słownictwo!' : 'You have new vocabulary!'}
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-300 leading-relaxed mb-6 font-medium">
            {language === 'pl'
              ? 'Twój nauczyciel przypisał nowe słownictwo oraz podsumowanie z przeprowadzonej lekcji. Przejdź do historii lekcji, aby przeanalizować materiał i rozpocząć trening.'
              : 'Your teacher added new vocabulary and lesson notes. Check your lesson history to review the material and start practicing.'}
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onViewHistory}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-sm sm:text-base shadow-[0_0_25px_rgba(16,185,129,0.45)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-5 h-5" />
              <span>{language === 'pl' ? 'Przejdź do historii lekcji' : 'Go to Lesson History'}</span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-semibold text-xs sm:text-sm transition-colors border border-white/10 cursor-pointer"
            >
              {language === 'pl' ? 'Zapoznam się później' : 'Review later'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NewVocabularyModal;
