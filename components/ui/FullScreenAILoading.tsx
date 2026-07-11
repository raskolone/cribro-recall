import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';

interface FullScreenAILoadingProps {
  message: string;
}

const FullScreenAILoading: React.FC<FullScreenAILoadingProps> = ({ message }) => {
  const content = (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-lg">
      <div className="relative flex items-center justify-center">
        {/* Pulsar effect outer rings */}
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-32 h-32 rounded-full border-2 border-primary bg-primary/5"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          className="absolute w-32 h-32 rounded-full bg-primary/20 blur-xl"
        />
        
        {/* Main circular container */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10 flex flex-col items-center justify-center w-32 h-32 rounded-full bg-base-100/50 backdrop-blur-md shadow-[0_0_30px_rgba(114,240,180,0.3)]"
        >
          {/* Circular progress bar */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-primary/20"
            />
            {/* Animated progress circle */}
            <motion.circle
              cx="64"
              cy="64"
              r="58"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-primary drop-shadow-[0_0_8px_rgba(114,240,180,0.8)]"
              strokeDasharray="364"
              animate={{ strokeDashoffset: [364, 0, 364] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              strokeLinecap="round"
            />
          </svg>
          
          {/* Center icon */}
          <div className="relative z-20">
            <svg className="w-10 h-10 text-primary drop-shadow-[0_0_8px_rgba(114,240,180,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <motion.path 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 10V3L4 14h7v7l9-11h-7z" 
              />
            </svg>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-12 relative z-10"
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