import React from 'react';

export type AIAssistantIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
export type AIAssistantIconVariant = 'icon' | 'avatar' | 'badge' | 'floating';
export type AIAssistantIconState = 'idle' | 'thinking' | 'online' | 'sparkle';

interface AIAssistantIconProps {
  /** Rozmiar ikony lub kontenera awatara */
  size?: AIAssistantIconSize;
  /** Wariant renderowania: tylko ikona, awatar w ramce, awatar ze wskaźnikiem online, lub pływający przycisk */
  variant?: AIAssistantIconVariant;
  /** Stan asystenta: bezczynny, generujący (animacja), online */
  state?: AIAssistantIconState;
  /** Czy dodać neonową poświatę (glow) wokół ikony */
  glow?: boolean;
  /** Dodatkowe klasy CSS */
  className?: string;
  /** Niestandardowy kolor ikony (domyślnie primary/emerald) */
  color?: string;
}

const SIZE_MAP: Record<string, { icon: number; box: string; ring: string }> = {
  xs: { icon: 14, box: 'w-6 h-6', ring: 'p-1' },
  sm: { icon: 18, box: 'w-8 h-8', ring: 'p-1.5' },
  md: { icon: 22, box: 'w-10 h-10', ring: 'p-2' },
  lg: { icon: 28, box: 'w-12 h-12', ring: 'p-2.5' },
  xl: { icon: 36, box: 'w-16 h-16', ring: 'p-3' },
  '2xl': { icon: 48, box: 'w-20 h-20', ring: 'p-4' },
};

/**
 * Autorski wektorowy symbol AI CRIBRO:
 * Łączy geometryczne łuki CRIBRO, promienistą 4-ramienną gwiazdę inteligencji
 * oraz orbitalne węzły synaptyczne z neonowym gradientem.
 */
export const AIAssistantGlyph: React.FC<{
  size?: number;
  className?: string;
  isThinking?: boolean;
}> = ({ size = 24, className = '', isThinking = false }) => {
  const uniqueId = React.useId().replace(/:/g, '');
  const gradId = `cribro-ai-grad-${uniqueId}`;
  const glowId = `cribro-ai-glow-${uniqueId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform ${isThinking ? 'animate-spin-slow' : ''} ${className}`}
    >
      <defs>
        {/* Gradient szmaragdowo-miętowy CRIBRO */}
        <linearGradient id={gradId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#72F0B4" />
          <stop offset="50%" stopColor="#38E196" />
          <stop offset="100%" stopColor="#0D8A5F" />
        </linearGradient>

        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Zewnętrzne pierścienie orbitalne inspirowane logo CRIBRO */}
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke={`url(#${gradId})`}
        strokeWidth="1.75"
        strokeDasharray="4 6"
        className={isThinking ? 'animate-spin origin-center' : 'opacity-60'}
        strokeLinecap="round"
      />

      {/* Przeciwbieżny subtelny łuk wewnętrzny */}
      <path
        d="M 12 16 A 15 15 0 0 1 36 16 M 36 32 A 15 15 0 0 1 12 32"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        className="opacity-40"
      />

      {/* Centralna gwiazda inteligencji (4-pointed radiant nexus) */}
      <path
        d="M 24 9 C 24 16.5 16.5 24 9 24 C 16.5 24 24 31.5 24 39 C 24 31.5 31.5 24 39 24 C 31.5 24 24 16.5 24 9 Z"
        fill={`url(#${gradId})`}
        filter={`url(#${glowId})`}
        className={isThinking ? 'animate-pulse' : ''}
      />

      {/* Iskry synaptyczne w narożnikach */}
      <circle cx="37" cy="11" r="2.2" fill="#72F0B4" className="animate-ping opacity-75 origin-center" style={{ animationDuration: '3s' }} />
      <circle cx="11" cy="37" r="1.8" fill="#72F0B4" className="opacity-90" />
      <circle cx="38" cy="36" r="1.5" fill="#38E196" className="opacity-70" />
      <circle cx="10" cy="12" r="1.5" fill="#38E196" className="opacity-70" />

      {/* Centralny rdzeń świetlny */}
      <circle cx="24" cy="24" r="3" fill="#FFFFFF" className="opacity-95" />
    </svg>
  );
};

/**
 * Główny komponent awatara/ikony Asystenta AI dla całej aplikacji CRIBRO
 */
export const AIAssistantIcon: React.FC<AIAssistantIconProps> = ({
  size = 'md',
  variant = 'avatar',
  state = 'idle',
  glow = true,
  className = '',
}) => {
  const sizeConfig = typeof size === 'string' ? (SIZE_MAP[size] || SIZE_MAP.md) : {
    icon: Math.round(size * 0.6),
    box: '',
    ring: 'p-2',
  };

  const isThinking = state === 'thinking';
  const customBoxStyle = typeof size === 'number' ? { width: size, height: size } : undefined;

  // Tylko ikona bez kontenera
  if (variant === 'icon') {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        <AIAssistantGlyph
          size={typeof size === 'number' ? size : sizeConfig.icon}
          isThinking={isThinking}
          className={glow ? 'drop-shadow-[0_0_10px_rgba(114,240,180,0.6)]' : ''}
        />
      </div>
    );
  }

  // Pełny awatar w szklanej ramce
  return (
    <div
      style={customBoxStyle}
      className={`relative inline-flex items-center justify-center rounded-2xl shrink-0 transition-all ${
        sizeConfig.box
      } ${
        isThinking
          ? 'bg-gradient-to-br from-primary/25 via-primary/15 to-emerald-950/40 border border-primary/60 shadow-[0_0_24px_rgba(114,240,180,0.4)] ring-2 ring-primary/30'
          : 'bg-gradient-to-br from-base-100/90 via-base-200/80 to-primary/10 border border-primary/35 shadow-[0_0_16px_rgba(114,240,180,0.2)] hover:border-primary/60 hover:shadow-[0_0_20px_rgba(114,240,180,0.35)]'
      } backdrop-blur-xl ${className}`}
    >
      {/* Dynamiczna poświata w tle awatara */}
      {glow && (
        <div
          className={`absolute inset-0 rounded-2xl bg-primary/20 blur-md pointer-events-none transition-opacity ${
            isThinking ? 'opacity-100 animate-pulse' : 'opacity-40 group-hover:opacity-75'
          }`}
        />
      )}

      {/* Symbol AI */}
      <AIAssistantGlyph
        size={typeof size === 'number' ? Math.round(size * 0.6) : sizeConfig.icon}
        isThinking={isThinking}
      />

      {/* Wskaźnik statusu online / aktywny (jeśli wariant badge lub state online) */}
      {(variant === 'badge' || state === 'online' || isThinking) && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
          {isThinking ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary border-2 border-base-200" />
            </>
          ) : (
            <>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary border-2 border-base-200 shadow-[0_0_6px_rgba(114,240,180,0.8)]" />
            </>
          )}
        </span>
      )}
    </div>
  );
};

export default AIAssistantIcon;
