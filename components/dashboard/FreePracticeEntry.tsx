import React from 'react';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FreePracticeEntryProps {
  onOpen: () => void;
}

/**
 * Jedyny punkt wejścia do „Ćwiczeń dowolnych" na pulpicie kursanta — widoczny zawsze,
 * także gdy nie ma żadnej pracy domowej. Celowo cichy (obrys, bez wypełnienia akcentem):
 * główną akcją pulpitu pozostaje praca domowa, a to jest „lub wykonaj inne ćwiczenia".
 */
const FreePracticeEntry: React.FC<FreePracticeEntryProps> = ({ onOpen }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="free-practice-entry"
      className="w-full min-h-14 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-line-strong bg-base-100/50 hover:bg-base-100/80 hover:border-primary/40 text-left cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200"
    >
      <span className="flex items-center gap-3 min-w-0">
        <Dumbbell size={18} className="shrink-0 text-content-muted" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-text-hi">{t('Ćwiczenia dowolne')}</span>
          <span className="block text-xs text-content-muted">
            {t('Fiszki, quiz, pisanie i dopasowanie — bez pracy domowej')}
          </span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-content-muted" aria-hidden="true" />
    </button>
  );
};

export default FreePracticeEntry;
