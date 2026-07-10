import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';

interface FullScreenAILoadingProps {
  message: string;
}

const FullScreenAILoading: React.FC<FullScreenAILoadingProps> = ({ message }) => {
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

  const content = (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-lg">
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-32 h-32 rounded-full bg-primary/20 blur-xl"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10 flex flex-col items-center justify-center w-32 h-32 rounded-full border-2 border-primary/50 shadow-[0_0_30px_rgba(114,240,180,0.3)] bg-base-100/30 backdrop-blur-sm"
        >
          <div className="text-3xl font-mono font-bold text-primary drop-shadow-md">
            {Math.floor(progress)}%
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 relative z-10"
      >
        <div className="text-xl font-bold text-white tracking-wide drop-shadow-md">
          {message}
        </div>
      </motion.div>
    </div>
  );

  return createPortal(content, document.body);
};

export default FullScreenAILoading;