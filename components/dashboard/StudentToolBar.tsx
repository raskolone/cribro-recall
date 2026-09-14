import React, { ReactNode } from 'react';

/**
 * Listwa narzędzi kursanta — kafelki zamiast stosu zwijanych sekcji.
 *
 * ══ SIATKA SYMETRYCZNA ══
 *
 * Dwie kolumny na telefonie, trzy od `sm` w górę — i dokładnie sześć
 * narzędzi, więc siatka WYPEŁNIA SIĘ CAŁA w obu układach: 3 rzędy po 2 albo
 * 2 rzędy po 3. Wcześniejsze `3/4/5 kolumn` przy siedmiu kafelkach zostawiało
 * na końcu rząd z jednym albo dwoma, czyli dziurę po prawej — a nic tak nie
 * psuje spokoju siatki jak niedokończony ostatni wiersz.
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
 * Kafelek ma co najmniej 104 px wysokości i na telefonie zajmuje pół
 * szerokości ekranu — to cel, w który trafia się kciukiem w tramwaju, bez
 * patrzenia. Dwie kolumny utrzymujemy do samego dołu skali: przy sześciu
 * krótkich podpisach mieszczą się bez ucinania nawet na 320 px.
 */

export interface StudentTool {
  id: string;
  /**
   * Identyfikator elementu w drzewie — używany przez samouczek, który
   * podświetla konkretne kafelki (`CoachMarks` szuka po `data-coach`).
   * Bez niego przewodnik nie ma czego wskazać i rysuje krok bez reflektora.
   */
  domId?: string;
  label: string;
  /** Jedno słowo albo liczba — co czeka w środku. Bez zdania. */
  meta?: string;
  icon: ReactNode;
  /**
   * Narzędzie tylko na duży ekran.
   *
   * Obecnie nieużywane: notatnik, jedyne takie miejsce, ma od tej rundy
   * układ działający na telefonie (spis treści kładzie się nad kartką),
   * a kursanci dostają go do rąk właśnie na telefonach. Pole zostaje, bo
   * następne narzędzie tej klasy może się zdarzyć.
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
    className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3"
  >
    {tools.map((tool) => {
      const isOpen = openId === tool.id;
      return (
        <button
          key={tool.id}
          id={tool.domId}
          /* Ten sam identyfikator służy samouczkowi (CoachMarks szuka po
             `data-coach`) i podświetleniu w przewodniku powitalnym. */
          data-coach={tool.domId}
          type="button"
          onClick={() => (tool.onNavigate ? tool.onNavigate() : onToggle(tool.id))}
          aria-expanded={tool.onNavigate ? undefined : isOpen}
          className={[
            // Wysokość, nie padding: kafelki mają być równe niezależnie od
            // tego, czy narzędzie ma podpis pod nazwą, czy nie.
            'glass-tile min-h-[6.5rem] p-3.5 rounded-2xl text-left flex-col justify-between gap-2 cursor-pointer',
            tool.desktopOnly ? 'hidden md:flex' : 'flex',
            isOpen ? 'is-open' : '',
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
