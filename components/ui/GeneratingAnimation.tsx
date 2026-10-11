import React from 'react';
import { useTranslation } from 'react-i18next';
import { GEN_ARROW_PATH, GEN_BALL_PATH, GEN_CIRCLE_PATH, GEN_VIEWBOX } from '../../utils/generatingAnimation';

/**
 * Oczekiwanie na wygenerowanie zadania: zielony kłębek poplątanych linii, obok cienka strzałka, po niej koło
 * rysuje się samo jednym odręcznym pociągnięciem. Czysto prezentacyjny, bez paska postępu i liczb (nie sugeruje
 * czasu). Pętla w CSS (`.gen-anim*` w index.css, tylko transform/opacity/stroke-dashoffset); przy
 * prefers-reduced-motion obraz jest statyczny (kłębek + strzałka + gotowe koło). Jeden krótki tekst z i18n.
 */
const GeneratingAnimation: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="generating-animation"
      className={`mx-auto flex min-h-[min(50dvh,360px)] w-full flex-col items-center justify-center gap-4 px-4 text-center ${className ?? ''}`}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={GEN_VIEWBOX}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="gen-anim h-auto w-full max-w-[280px]"
      >
        <path className="gen-anim__ball" d={GEN_BALL_PATH} strokeWidth="2.5" />
        <path className="gen-anim__arrow" d={GEN_ARROW_PATH} pathLength={1} strokeWidth="2" />
        <path className="gen-anim__circle" d={GEN_CIRCLE_PATH} pathLength={1} strokeWidth="3" />
      </svg>
      <p className="text-base font-medium text-text-hi">{t('Przygotowuję ćwiczenie…')}</p>
    </div>
  );
};

export default GeneratingAnimation;
