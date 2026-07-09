import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Hourglass } from 'lucide-react';

interface InlineAILoadingProps {
  language: 'pl' | 'en';
}

const InlineAILoading: React.FC<InlineAILoadingProps> = ({ language }) => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const duration = 5000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let newProgress = (elapsed / duration) * 100;
      
      if (newProgress > 98) {
        newProgress = 98 + Math.sin(elapsed / 500) * 1;
      }
      
      setProgress(newProgress);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex items-center justify-center p-3 md:p-4 bg-primary/10 rounded-xl border border-primary/30 backdrop-blur-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] gap-4"
    >
      <motion.div
        animate={{ rotate: [0, 180, 180, 360] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Hourglass className="w-5 h-5 text-primary" />
      </motion.div>
      
      <div className="flex-1 max-w-xs flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs md:text-sm font-medium text-primary">
          <span>{language === 'pl' ? 'Przygotowywanie zadań...' : 'Preparing exercises...'}</span>
          <span className="font-mono">{Math.floor(progress)}%</span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden shadow-inner">
          <motion.div 
            className="h-full bg-gradient-to-r from-emerald-500 to-primary relative"
            style={{ width: `${progress}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
          >
            <motion.div 
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default InlineAILoading;
