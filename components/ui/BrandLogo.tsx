import React from 'react';

export const BrandLogo: React.FC<{ className?: string; showTagline?: boolean; isCollapsed?: boolean }> = ({ className = "text-xl", showTagline = false, isCollapsed = false }) => {
  return (
    <div className={`flex items-center gap-[0.5em] ${className}`}>
      <div className="relative flex-shrink-0 h-[2.5em] w-[2.5em] flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full text-primary drop-shadow-[0_0_12px_rgba(74,222,128,0.5)]">
          {/* Outer arc: Center 50,50 R=40, from -35 deg to +35 deg around the left */}
          <path d="M 82.7 27 A 40 40 0 1 0 82.7 73" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
          
          {/* Inner arc: Center 50,50 R=25, from +45 deg to -45 deg around the left */}
          <path d="M 67.6 67.6 A 25 25 0 1 1 67.6 32.4" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          
          {/* Dot */}
          <circle cx="67.6" cy="67.6" r="6.5" fill="currentColor" />
        </svg>
      </div>
      {!isCollapsed && <div className="flex flex-col justify-center leading-none mt-[0.1em]">
        <span className="text-[1.1em] font-sans font-medium tracking-[0.05em] text-white">CRIBRO</span>
        <span className="text-[1.1em] font-sans font-black tracking-tight text-primary mt-[-0.1em]">ENGLISH</span>
        {showTagline && (
          <span className="text-[0.45em] font-sans tracking-widest text-[#a0a0a0] mt-[0.3em] uppercase">
            less noise. more language.
          </span>
        )}
      </div>}
    </div>
  );
};

export default BrandLogo;
