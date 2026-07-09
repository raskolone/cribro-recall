import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Hourglass } from 'lucide-react';

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

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-base-300/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex items-center justify-center"
      >
        <svg className="w-48 h-48 transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-base-100/50"
          />
          <motion.circle
            cx="96"
            cy="96"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="text-primary drop-shadow-[0_0_10px_rgba(114,240,180,0.8)]"
            transition={{ ease: "linear", duration: 0.1 }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: [0, 180, 180, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex items-center justify-center w-20 h-20 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1))',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3), inset 0 0 15px rgba(255,255,255,0.2)'
            }}
          >
             <Hourglass className="w-10 h-10 text-white drop-shadow-md" strokeWidth={1.5} />
             <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-gradient-to-tr from-transparent via-white/40 to-transparent transform rotate-45" />
             </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 flex flex-col items-center gap-2"
      >
        <div className="text-xl font-bold text-white tracking-wide">
          {message}
        </div>
        <div className="font-mono text-primary font-bold text-lg">
          {Math.floor(progress)}%
        </div>
      </motion.div>
    </div>
  );
};

export default FullScreenAILoading;
