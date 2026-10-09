import React, { ReactNode } from 'react';
import Card from '../ui/Card';

/**
 * Jedna strona karty fiszki — wspólny, czysto prezentacyjny markup dla modułu fiszek
 * (FlashcardsMode) i rozgrzewki (HomeworkWarmupCards). Bez logiki SRS, kontekstów,
 * motion/react i zapisu; ruch (obrót, odlot) robi rodzic.
 *
 * Obie strony leżą w JEDNEJ komórce siatki rodzica (`grid`): `.liquid-glass-card` ma
 * `position: relative` poza warstwą Tailwinda i nadpisywałoby `absolute`.
 */

export const FACE_BASE_CLASS =
  'col-start-1 row-start-1 min-h-[240px] sm:min-h-[300px] backface-hidden flex flex-col items-center justify-center text-center p-6 sm:p-8';
export const FRONT_CLASS = 'border border-line-strong hover:border-primary/50 transition-colors';
export const BACK_CLASS = 'border border-primary/50 shadow-[0_0_30px_rgba(114,240,180,0.15)]';
export const ACTIONS_CLASS = 'absolute top-3 right-3 z-10 flex gap-2';
export const FRONT_LABEL_CLASS = 'text-sm font-mono text-text-2 uppercase tracking-widest mb-6';
export const BACK_LABEL_CLASS = 'text-sm font-mono text-primary uppercase tracking-widest mb-6';
export const FRONT_BODY_CLASS = 'text-3xl sm:text-4xl md:text-5xl font-bold text-text-hi break-words max-w-full';
export const BACK_BODY_CLASS = 'text-2xl sm:text-3xl md:text-4xl font-bold text-text-hi break-words max-w-full';

export interface FlashcardFaceProps {
  side: 'front' | 'back';
  label: string;
  /** Treść jako zaufany HTML (moduł fiszek trzyma w fiszkach znaczniki). */
  html?: string;
  /** Treść jako zwykły tekst/węzły (rozgrzewka). */
  children?: ReactNode;
  /** Prawy górny róg: przyciski wymowy itp. */
  actions?: ReactNode;
  /** Pod treścią, np. zdanie z przykładem na rewersie. */
  footer?: ReactNode;
  testId?: string;
  /** Strona odwrócona od widza: aria-hidden + inert (nie łapie fokusu ani kliknięć). */
  turnedAway?: boolean;
  /**
   * Bez obrotu 3D (ograniczenie ruchu): brak backface/rotateY, a strona odwrócona od widza
   * jest po prostu `invisible`.
   */
  flat?: boolean;
}

const FlashcardFace: React.FC<FlashcardFaceProps> = ({
  side,
  label,
  html,
  children,
  actions,
  footer,
  testId,
  turnedAway,
  flat,
}) => {
  const isFront = side === 'front';
  const style: React.CSSProperties | undefined = flat
    ? undefined
    : isFront
      ? { backfaceVisibility: 'hidden' }
      : { backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' };
  const bodyClass = isFront ? FRONT_BODY_CLASS : BACK_BODY_CLASS;

  return (
    <Card
      data-face={side}
      data-testid={testId}
      aria-hidden={turnedAway === undefined ? undefined : turnedAway}
      {...(turnedAway ? { inert: true } : {})}
      className={`${FACE_BASE_CLASS} ${isFront ? FRONT_CLASS : BACK_CLASS}${flat && turnedAway ? ' invisible' : ''}`}
      style={style}
    >
      {actions && <div className={ACTIONS_CLASS}>{actions}</div>}
      <div className={isFront ? FRONT_LABEL_CLASS : BACK_LABEL_CLASS}>{label}</div>
      {html !== undefined ? (
        <div className={bodyClass} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className={bodyClass}>{children}</div>
      )}
      {footer}
    </Card>
  );
};

export default FlashcardFace;
