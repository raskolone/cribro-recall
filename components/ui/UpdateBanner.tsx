import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePwaUpdate } from '../../hooks/usePwaUpdate';

/**
 * Baner „Dostępna nowa wersja" — pokazuje się, gdy nowy service worker przejął kontrolę,
 * a otwarta strona działa jeszcze na starym kodzie. Przeładowanie robi dopiero kliknięcie:
 * kursant bywa w środku ćwiczenia. Leży przy dolnej krawędzi nad paskiem gestów (safe-area).
 */
const UpdateBanner: React.FC = () => {
  const { t } = useTranslation();
  const { visible, apply, dismiss } = usePwaUpdate();
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[350] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        data-testid="update-banner"
        className="pointer-events-auto mx-auto max-w-md flex items-center gap-2 rounded-2xl border border-primary/40 bg-base-200 text-text-hi shadow-[var(--shadow-lg)] p-2 pl-4"
      >
        <span className="min-w-0 flex-1 text-sm font-semibold">{t('Dostępna nowa wersja')}</span>
        <button
          type="button"
          onClick={apply}
          className="shrink-0 min-h-11 px-4 inline-flex items-center gap-2 rounded-xl bg-primary text-accent-ink text-sm font-bold cursor-pointer"
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t('Odśwież')}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('Zamknij')}
          className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-content-muted hover:text-text-hi cursor-pointer"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
