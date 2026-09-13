import React, { ReactNode } from 'react';

/**
 * Listwa narzędzi kursanta — kafelki zamiast stosu zwijanych sekcji.
 *
 * ══ PO CO KAFELKI ══
 *
 * Panel kursanta jest oglądany przede wszystkim na telefonie, w przeglądarce,
 * między zajęciami. Stos sześciu zwijanych pasków znaczył tam jedno: żeby
 * dojść do testów, trzeba było przewinąć wszystko powyżej. Kafelki mieszczą
 * cały spis możliwości nad zgięciem — kursant widzi naraz, co ma do wyboru,
 * i schodzi w dół tylko po treść, którą sam otworzył.
 *
 * ══ DLACZEGO JEDEN OTWARTY NARAZ ══
 *
 * Treść otwiera się POD listwą, nie w kafelku. Dwa otwarte panele
 * odsuwałyby drugi tak daleko, że kafelki przestałyby być punktem
 * odniesienia; tak zaś miejsce, w którym pojawia się treść, jest zawsze to
 * samo, a powrót do spisu to jedno dotknięcie tego samego kafelka.
 *
 * ══ DUŻE CELE DOTYKU ══
 *
 * Kafelek ma co najmniej 96 px wysokości i na telefonie zajmuje pół
 * szerokości ekranu — to cel, w który trafia się kciukiem w tramwaju, bez
 * patrzenia. Pod 360 px wracamy do jednej kolumny, bo dwa kafelki obok
 * siebie zmieściłyby się już tylko z uciętym napisem.
 */

export interface StudentTool {
  id: string;
  label: string;
  /** Jedno słowo albo liczba — co czeka w środku. Bez zdania. */
  meta?: string;
  icon: ReactNode;
  /**
   * Narzędzie tylko na duży ekran.
   *
   * Notatnik jest jedynym takim miejscem: to płótno do pisania razem z
   * lektorem, a nie treść do przejrzenia. Na telefonie kafelek go nie
   * pokazuje — lepszy brak wejścia niż wejście do czegoś, czego nie da się
   * tam używać.
   */
  desktopOnly?: boolean;
  /** Zamiast panelu pod listwą — przejście gdzie indziej. */
  onNavigate?: () => void;
  /** Czy coś czeka: kropka na kafelku, nie liczba w kółku. */
  highlight?: boolean;
}

interface StudentToolBarProps {
  tools: StudentTool[];
  /** Identyfikator otwartego narzędzia albo null. */
  openId: string | null;
  onToggle: (id: string) => void;
}

const StudentToolBar: React.FC<StudentToolBarProps> = ({ tools, openId, onToggle }) => (
  <nav
    aria-label="Narzędzia kursanta"
    className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5"
  >
    {tools.map((tool) => {
      const isOpen = openId === tool.id;
      return (
        <button
          key={tool.id}
          type="button"
          onClick={() => (tool.onNavigate ? tool.onNavigate() : onToggle(tool.id))}
          aria-expanded={tool.onNavigate ? undefined : isOpen}
          className={[
            // Wysokość, nie padding: kafelki mają być równe niezależnie od
            // tego, czy narzędzie ma podpis pod nazwą, czy nie.
            'relative min-h-[6rem] p-3 rounded-2xl border text-left flex flex-col justify-between gap-2',
            'transition-colors active:scale-[0.98]',
            tool.desktopOnly ? 'hidden md:flex' : 'flex',
            isOpen
              ? 'border-primary/50 bg-primary/[0.10]'
              : 'border-line-strong bg-base-200/50 hover:border-line-strong hover:bg-base-200/80',
          ].join(' ')}
        >
          <span
            className={`shrink-0 ${isOpen ? 'text-primary' : 'text-content-muted'} transition-colors`}
          >
            {tool.icon}
          </span>

          <span className="min-w-0">
            <span
              className={`block text-[13px] sm:text-sm font-bold leading-tight ${
                isOpen ? 'text-primary' : 'text-text-hi'
              }`}
            >
              {tool.label}
            </span>
            {tool.meta && (
              <span className="block text-[11px] font-mono text-content-muted mt-0.5 truncate">
                {tool.meta}
              </span>
            )}
          </span>

          {/* Kolor jako sygnał stanu: kropka mówi „tu coś na ciebie czeka".
              Liczba w kółku mówiłaby to samo, tylko drobniej i na telefonie
              nieczytelnie. */}
          {tool.highlight && !isOpen && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      );
    })}
  </nav>
);

export default StudentToolBar;
