import React, { ReactNode } from 'react';

/**
 * JEDNO OKNO — wspólna rama każdej zakładki kursanta.
 *
 * ══ PO CO TO ISTNIEJE ══
 *
 * Sześć zakładek profilu kursanta było zbudowanych sześcioma różnymi
 * sposobami: historia miała `h3` nad paskiem przycisków, słownictwo `h3`
 * z przyciskami po prawej bez ramy, statystyki gołą siatkę kafelków bez
 * nagłówka, testy trzy nagłówki jeden pod drugim. Ta sama informacja
 * („gdzie jestem, co tu mogę zrobić") stała za każdym razem gdzie indziej
 * i wyglądała inaczej, więc każde wejście w zakładkę zaczynało się od
 * szukania.
 *
 * Teraz każda zakładka to OKNO: pasek tytułu z ikoną i licznikiem po lewej,
 * narzędzia po prawej, treść w środku, zawsze ten sam obrys i ten sam
 * odstęp. Zakładki różnią się treścią, nie budową.
 *
 * ══ DLACZEGO NARZĘDZIA SĄ W PASKU TYTUŁU ══
 *
 * Bo są własnością tej zakładki, a nie całego profilu. Przycisk „Pobierz
 * z Notion" stał wcześniej w nagłówku kursanta, czyli nad zakładką
 * statystyk i pracy domowej, których Notion nie dotyczy. Narzędzie stoi
 * w oknie, którego dotyczy — albo nie stoi nigdzie.
 */

interface StudentPanelSectionProps {
  title: string;
  /** Jedno zdanie: co to jest i po co. Nie instrukcja obsługi. */
  subtitle?: string;
  icon?: ReactNode;
  /** Licznik przy tytule (liczba lekcji, zestawów itd.). */
  count?: number;
  /** Narzędzia tej sekcji — prawa strona paska tytułu. */
  actions?: ReactNode;
  /** Pas pod paskiem tytułu: filtry, przełączniki, komunikaty stanu. */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Treść bez wewnętrznego marginesu — dla tabel na pełną szerokość okna. */
  flush?: boolean;
  className?: string;
}

const StudentPanelSection: React.FC<StudentPanelSectionProps> = ({
  title,
  subtitle,
  icon,
  count,
  actions,
  toolbar,
  children,
  flush = false,
  className = '',
}) => (
  <section
    className={`rounded-2xl border border-line-strong bg-base-200/60 shadow-ambient-sm overflow-hidden ${className}`}
  >
    <header className="px-4 sm:px-5 py-3.5 border-b border-line-strong bg-base-100/40 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className="p-1.5 rounded-lg bg-primary/12 text-primary border border-primary/25 shrink-0 flex items-center justify-center">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-text-hi flex items-center gap-2 truncate">
            <span className="truncate">{title}</span>
            {typeof count === 'number' && count > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 shrink-0">
                {count}
              </span>
            )}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-content-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </header>

    {toolbar && (
      <div className="px-4 sm:px-5 py-2.5 border-b border-line bg-base-100/20 flex flex-wrap items-center gap-3">
        {toolbar}
      </div>
    )}

    <div className={flush ? '' : 'p-4 sm:p-5'}>{children}</div>
  </section>
);

export default StudentPanelSection;
