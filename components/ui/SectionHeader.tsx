import React, { ReactNode } from 'react';

/**
 * Nagłówek sekcji — wzorzec z design/app-spec/screens.md („Cross-cutting UI
 * patterns to preserve"): tytuł krojem szeryfowym, nad nim monospace'owy
 * kicker, pod nim jedno zdanie opisu.
 *
 * Motyw rezerwuje monospace dla etykiet, liczników i metadanych, więc leci on
 * na krótki kicker — pełne zdanie podtytułu zostaje prozą, bo wersaliki w
 * monospace na 11px z rozstrzeleniem 0.14em przestają się czytać po trzech
 * słowach. Treść bierze się z sectionMeta.ts, więc nowa sekcja to wpis w
 * tabeli, a nie kolejny wariant nagłówka.
 */

interface SectionHeaderProps {
  title: ReactNode;
  /** Krótka etykieta nad tytułem — monospace, wersaliki. */
  kicker?: ReactNode;
  /** Jedno zdanie pod tytułem. */
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Slot po prawej — przyciski, filtry, liczniki. */
  actions?: ReactNode;
  /** Linia pod nagłówkiem. Wyłącz, gdy sekcja rysuje własną. */
  divider?: boolean;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  kicker,
  subtitle,
  icon,
  actions,
  divider = true,
  className = '',
}) => (
  <div
    className={[
      'flex flex-col md:flex-row md:items-start justify-between gap-4',
      divider ? 'border-b border-line pb-6' : '',
      className,
    ].filter(Boolean).join(' ')}
  >
    <div className="min-w-0">
      {kicker && (
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-mute">
          {kicker}
        </p>
      )}
      <h1 className="text-3xl font-bold text-text-hi tracking-tight flex items-center gap-3">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <span className="min-w-0">{title}</span>
      </h1>
      {subtitle && (
        <p className="mt-2 text-sm text-text-2 max-w-2xl">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export default SectionHeader;
