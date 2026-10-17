import React, { ReactNode, useRef } from 'react';
import Card from '../ui/Card';
import { useFitFontSize } from '../../hooks/useFitFontSize';
import { htmlToPlainText } from '../../utils/fitFontSize';

/**
 * Jedna strona karty fiszki — wspólny, czysto prezentacyjny markup dla modułu fiszek
 * (FlashcardsMode) i rozgrzewki (HomeworkWarmupCards). Bez logiki SRS, kontekstów,
 * motion/react i zapisu; ruch (obrót, odlot) robi rodzic.
 *
 * Obie strony leżą w JEDNEJ komórce siatki rodzica (`grid`): `.liquid-glass-card` ma
 * `position: relative` poza warstwą Tailwinda i nadpisywałoby `absolute`.
 *
 * Rozmiar karty jest stały (CARD_SIZE_CLASS: szerokość min(100%, 26rem), wysokość 20rem), taki sam
 * dla wszystkich kart i obu stron: obrót ani długość tekstu go nie zmieniają. Rodzic musi dać kartom
 * określoną szerokość (`w-full`), inaczej `100%` liczy się od szerokości zależnej od treści.
 *
 * Pasek górny (HEADER_CLASS) to osobny wiersz: etykieta po lewej, przyciski po prawej, bez nakładania. Tekst dopasowuje czcionkę do pola (useFitFontSize, od
 * FIT_MAX_REM do FIT_MIN_REM); gdy nie mieści się przy minimum, przewija się wewnątrz karty.
 */

export const FIT_MAX_REM = 2.5;
export const FIT_MIN_REM = 0.9;
export const CARD_SIZE_CLASS = 'w-[min(100%,26rem)] h-80 shrink-0 justify-self-center';

export const FACE_BASE_CLASS =
  'col-start-1 row-start-1 min-h-0 overflow-hidden backface-hidden flex flex-col items-center justify-start text-center p-4 sm:p-6 ' + CARD_SIZE_CLASS;
export const FRONT_CLASS = 'border border-line-strong hover:border-primary/50 transition-colors';
export const BACK_CLASS = 'border border-primary/50 shadow-[0_0_30px_rgba(114,240,180,0.15)]';
export const HEADER_CLASS = 'flex shrink-0 flex-nowrap items-center justify-between gap-2 w-full mb-3';
export const ACTIONS_CLASS = 'flex shrink-0 items-center gap-1.5 [&_button]:shrink-0';
export const FRONT_LABEL_CLASS = 'min-w-0 truncate text-sm font-mono text-text-2 uppercase tracking-widest';
export const BACK_LABEL_CLASS = 'min-w-0 truncate text-sm font-mono text-primary uppercase tracking-widest';
export const FRONT_BODY_CLASS = 'my-auto font-bold leading-tight text-text-hi break-words max-w-full';
/** Pole na tekst: zajmuje resztę karty, przewija się tylko, gdy tekst nie mieści się przy minimum. */
export const BODY_BOX_CLASS = 'flex flex-col flex-1 min-h-0 w-full overflow-y-auto';
export const BACK_BODY_CLASS = 'my-auto font-bold leading-tight text-text-hi break-words max-w-full';

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
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const plain = html !== undefined ? htmlToPlainText(html) : typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  const fontSize = useFitFontSize(boxRef, textRef, plain, { maxRem: FIT_MAX_REM, minRem: FIT_MIN_REM });
  const bodyStyle: React.CSSProperties = { fontSize: fontSize !== undefined ? `${fontSize}px` : `${FIT_MAX_REM}rem` };

  return (
    <Card
      data-face={side}
      data-testid={testId}
      aria-hidden={turnedAway === undefined ? undefined : turnedAway}
      {...(turnedAway ? { inert: true } : {})}
      className={`${FACE_BASE_CLASS} ${isFront ? FRONT_CLASS : BACK_CLASS}${flat && turnedAway ? ' invisible' : ''}`}
      style={style}
    >
      <div data-testid={testId ? `${testId}-header` : undefined} data-face-header className={HEADER_CLASS}>
        <div data-face-label className={isFront ? FRONT_LABEL_CLASS : BACK_LABEL_CLASS}>{label}</div>
        {actions && <div data-face-actions className={ACTIONS_CLASS}>{actions}</div>}
      </div>
      <div ref={boxRef} className={BODY_BOX_CLASS}>
        {html !== undefined ? (
          <div ref={textRef} className={bodyClass} style={bodyStyle} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div ref={textRef} className={bodyClass} style={bodyStyle}>{children}</div>
        )}
      </div>
      {footer && <div className="shrink-0 w-full max-h-[35%] overflow-y-auto">{footer}</div>}
    </Card>
  );
};

export default FlashcardFace;
