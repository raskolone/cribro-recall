import React from 'react';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FreePracticeEntryProps {
  onOpen: () => void;
}

/**
 * Jedyny punkt wejścia do „Ćwiczeń dowolnych" na pulpicie kursanta — widoczny zawsze,
 * także gdy nie ma żadnej pracy domowej.
 *
 * Akcent jest wyraźny, ale mały: cienka obwódka i wypełniona plakietka ikony w kolorze
 * akcentu (tokeny motywu, oba tryby; w jasnym pełny kolor — obwódka 70% dawała 2,75:1, a WCAG 1.4.11 wymaga 3:1). Cały wiersz NIE jest wypełniony — główną akcją
 * pulpitu zostaje pełnoszeroki, wypełniony przycisk „Rozwiąż zadania", a to jest
 * „lub wykonaj inne ćwiczenia".
 */
const FreePracticeEntry: React.FC<FreePracticeEntryProps> = ({ onOpen }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="free-practice-entry"
      className="w-full min-h-14 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-primary dark:border-primary/70 bg-base-100/50 hover:bg-base-100/80 dark:hover:border-primary text-left cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-200"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span
          data-testid="free-practice-icon"
          className="shrink-0 w-9 h-9 rounded-xl bg-primary text-accent-ink flex items-center justify-center"
          aria-hidden="true"
        >
          <Dumbbell size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-text-hi">{t('Ćwiczenia dowolne')}</span>
          <span className="block text-xs text-content-muted">
            {t('Fiszki, quiz, pisanie i dopasowanie — bez pracy domowej')}
          </span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-primary" aria-hidden="true" />
    </button>
  );
};

export default FreePracticeEntry;
