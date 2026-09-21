import React from 'react';
import { Laptop } from 'lucide-react';

interface DesktopOnlyNoticeProps {
  moduleName: string;
  onBack?: () => void;
}

/**
 * Zastępuje moduły, których nie da się sensownie skrócić na telefon
 * (notatnik A4, planer lekcji) — pokazywany tylko pod `md` (768px).
 */
const DesktopOnlyNotice: React.FC<DesktopOnlyNoticeProps> = ({ moduleName, onBack }) => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-4 px-6 py-10 max-w-sm mx-auto">
    <div className="p-3.5 rounded-2xl bg-line-soft border border-line-strong text-primary">
      <Laptop size={28} />
    </div>
    <div className="space-y-1.5">
      <h2 className="text-base font-bold text-text-hi">{moduleName}</h2>
      <p className="text-sm text-content-muted leading-relaxed">
        Ten moduł został zoptymalizowany pod komputery i tablety. Skorzystaj z wersji desktopowej.
      </p>
    </div>
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-xl bg-line-soft hover:bg-line-soft text-content-muted hover:text-text-hi text-xs font-bold transition-all border border-line-strong cursor-pointer"
      >
        Wróć do strony głównej
      </button>
    )}
  </div>
);

export default DesktopOnlyNotice;
