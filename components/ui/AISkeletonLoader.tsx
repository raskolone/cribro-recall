import React from 'react';
import { Sparkles } from 'lucide-react';

interface AISkeletonLoaderProps {
  variant?: 'cards' | 'text' | 'sentences';
  count?: number;
  message?: string;
}

const AISkeletonLoader: React.FC<AISkeletonLoaderProps> = ({ 
  variant = 'text', 
  count = 3, 
  message = "Sztuczna inteligencja przygotowuje dane..." 
}) => {
  return (
    <div className="w-full space-y-4">
      {/* Dynamic CSS for Shimmer & Hover */}
      <style>{`
        @keyframes customShimmer {
          100% { transform: translateX(100%); }
        }
        .custom-shimmer-bg {
          position: relative;
          overflow: hidden;
        }
        .custom-shimmer-bg::after {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.06) 20%,
            rgba(255, 255, 255, 0.1) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: customShimmer 2s infinite;
          content: '';
        }
      `}</style>

      {/* Loading message banner */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl shadow-inner animate-pulse">
        <Sparkles className="w-4.5 h-4.5 text-primary animate-spin" />
        <span className="text-xs md:text-sm font-semibold text-primary">{message}</span>
      </div>

      {variant === 'text' && (
        <div className="space-y-3 bg-base-200/40 p-4 border border-white/5 rounded-xl custom-shimmer-bg">
          <div className="h-4 bg-white/10 rounded-full w-3/4 animate-pulse" />
          <div className="h-3.5 bg-white/10 rounded-full w-full animate-pulse" style={{ animationDelay: '0.15s' }} />
          <div className="h-3.5 bg-white/10 rounded-full w-5/6 animate-pulse" style={{ animationDelay: '0.3s' }} />
          <div className="h-3.5 bg-white/10 rounded-full w-2/3 animate-pulse" style={{ animationDelay: '0.45s' }} />
        </div>
      )}

      {variant === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(count)].map((_, i) => (
            <div 
              key={i} 
              className="p-5 border border-white/5 bg-base-200/30 rounded-xl flex flex-col gap-3 shadow-md custom-shimmer-bg"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 bg-white/10 rounded-full w-24 animate-pulse" />
                <div className="h-4 bg-primary/15 rounded-md w-10 animate-pulse" />
              </div>
              <div className="h-3.5 bg-white/10 rounded-full w-full animate-pulse" style={{ animationDelay: '0.1s' }} />
              <div className="h-3 bg-white/10 rounded-full w-3/4 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="flex gap-2 mt-2">
                <div className="h-6 bg-white/5 rounded-full w-14 animate-pulse" />
                <div className="h-6 bg-white/5 rounded-full w-14 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === 'sentences' && (
        <div className="space-y-4">
          {[...Array(count)].map((_, i) => (
            <div 
              key={i} 
              className="p-4 border border-white/5 bg-base-200/40 rounded-xl flex flex-col gap-2.5 custom-shimmer-bg"
            >
              <div className="flex justify-between items-center">
                <div className="h-3.5 bg-primary/20 rounded-full w-16 animate-pulse" />
                <div className="h-3 bg-white/5 rounded-full w-12 animate-pulse" />
              </div>
              <div className="h-4.5 bg-white/10 rounded-full w-5/6 animate-pulse" style={{ animationDelay: '0.1s' }} />
              <div className="h-3.5 bg-white/5 rounded-full w-2/3 animate-pulse" style={{ animationDelay: '0.2s' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AISkeletonLoader;
