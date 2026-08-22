import React, { ReactNode } from 'react';

/**
 * Pigułka statusu — receptura `.badge` z design/theme/components.md.
 *
 * Motyw dopuszcza dokładnie cztery tony: akcent plus trzy barwy stanu, każda
 * przy tym samym wypełnieniu 12% i krawędzi 30%. Warianty różnią się wyłącznie
 * odcieniem, nigdy kształtem ani wagą — dzięki temu „sprawdzone", „oczekuje"
 * i „do omówienia" czyta się jako jedną rodzinę, a nie trzy osobne wynalazki.
 */

export type BadgeTone = 'accent' | 'warn' | 'danger' | 'info' | 'neutral';

/** Statusy testów i zadań wg design/app-spec/data-shapes.md. */
export type BadgeStatus = 'ok' | 'wait' | 'low';

const TONES: Record<BadgeTone, string> = {
  accent: 'bg-primary/12 border-primary/30 text-primary',
  warn: 'bg-warn/12 border-warn/30 text-warn',
  danger: 'bg-danger/12 border-danger/30 text-danger',
  info: 'bg-info/12 border-info/30 text-info',
  neutral: 'bg-white/5 border-line-strong text-text-2',
};

const STATUS_TONE: Record<BadgeStatus, BadgeTone> = {
  ok: 'accent',
  wait: 'warn',
  low: 'danger',
};

/** Mapuje status domenowy na ton, żeby ekrany nie powtarzały tej decyzji. */
export const toneForStatus = (status: BadgeStatus): BadgeTone => STATUS_TONE[status];

interface BadgeProps {
  children: ReactNode;
  /** Ton wprost. Pomijany, jeśli podano `status`. */
  tone?: BadgeTone;
  /** Status domenowy — wygodniejszy niż dobieranie tonu ręcznie. */
  status?: BadgeStatus;
  icon?: ReactNode;
  /** Wyłącza wersaliki i światło międzyliterowe — dla treści, nie etykiet. */
  plain?: boolean;
  className?: string;
  title?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  tone = 'accent',
  status,
  icon,
  plain = false,
  className = '',
  title,
}) => {
  const resolved = status ? STATUS_TONE[status] : tone;

  return (
    <span
      title={title}
      className={[
        'inline-flex items-center gap-2 px-3 py-[5px] rounded-full border',
        'font-mono text-[11px] font-medium whitespace-nowrap',
        plain ? '' : 'uppercase tracking-[0.1em]',
        TONES[resolved],
        className,
      ].filter(Boolean).join(' ')}
    >
      {icon}
      {children}
    </span>
  );
};

export default Badge;
