import React, { useState } from 'react';
import { ChevronDown, Database, Mic } from 'lucide-react';
import { LessonRecord } from '../../types';

/**
 * Skąd bierze się historia lekcji tego kursanta.
 *
 * ══ PO CO TO WIDAĆ ══
 *
 * Od kiedy lekcje mają dwa źródła (notatki z Notion i transkrypcje z Cribro
 * Sift), „historia lekcji" przestała być jedną listą z jednego miejsca.
 * Pytanie „skąd to się wzięło i czego tu brakuje" zadaje się przy każdej
 * lekcji, której lektor nie pamięta — a odpowiedź dotąd nie istniała
 * w interfejsie, tylko w cudzej głowie.
 *
 * ══ DLACZEGO TO JEST ZWINIĘTE I BEZ PRZYCISKU ══
 *
 * Pasek zajmował dwie duże karty nad listą lekcji i powtarzał przycisk
 * „Sprawdź Notion", który stoi już w zestawie narzędzi tej zakładki. Ten
 * sam przycisk w dwóch miejscach na jednym ekranie znaczy tylko tyle, że
 * nie wiadomo, który jest właściwy.
 *
 * Pochodzenie lekcji to STAN, nie czynność: odpowiedź jest potrzebna raz na
 * jakiś czas, a nie przy każdym wejściu w zakładkę. Domyślnie widać więc
 * jedną linijkę z liczbami; karty z opisem rozwija się kliknięciem. Jedyne,
 * co przebija się przez zwinięcie, to transkrypcja czekająca na lektora —
 * bo to jedyna rzecz w tym pasku, która wymaga czynności.
 */

interface LessonSourceBarProps {
  lessons: LessonRecord[];
  studentName?: string;
}

const LessonSourceBar: React.FC<LessonSourceBarProps> = ({ lessons, studentName }) => {
  const [isOpen, setIsOpen] = useState(false);

  /*
   * Rekordy sprzed dwóch źródeł nie mają pola `source` — wszystkie pochodzą
   * z Notion, więc brak wartości liczy się jako Notion, a nie jako „inne".
   */
  const fromNotion = lessons.filter((l) => !l.source || l.source === 'notion').length;
  const fromTranscript = lessons.filter((l) => l.source === 'live_transcript').length;
  const manual = lessons.length - fromNotion - fromTranscript;

  const awaitingTeacher = lessons.filter(
    (l) => l.source === 'live_transcript' && l.sessionStatus !== 'completed'
  ).length;

  const lastNotion = lessons
    .filter((l) => !l.source || l.source === 'notion')
    .map((l) => l.date)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0];

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer group"
        title="Pokaż, z jakich źródeł pochodzi ta historia"
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 text-[11px] text-content-muted">
          <span className="font-extrabold uppercase tracking-wider">Źródło historii</span>
          <span className="font-mono">
            Notion <strong className="text-text-hi">{fromNotion}</strong>
            {lastNotion ? ` · ost. ${lastNotion}` : ''}
          </span>
          <span className="font-mono">
            Sift <strong className="text-text-hi">{fromTranscript}</strong>
          </span>
          {manual > 0 && (
            <span className="font-mono">
              Ręcznie <strong className="text-text-hi">{manual}</strong>
            </span>
          )}
          {/* Kolor jako sygnał stanu — jedyna rzecz tutaj, która czeka na lektora. */}
          {awaitingTeacher > 0 && (
            <span className="font-bold text-primary">
              {awaitingTeacher}{' '}
              {awaitingTeacher === 1 ? 'transkrypcja czeka' : 'transkrypcje czekają'} na bloki
            </span>
          )}
        </span>

        <ChevronDown
          size={15}
          className={`shrink-0 text-content-muted group-hover:text-text-hi transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ── Notion: źródło ciągnione ── */}
          <div className="rounded-xl border border-line-strong bg-base-100/50 p-3.5 flex items-start gap-2.5">
            <span className="p-2 rounded-lg bg-primary/12 text-primary border border-primary/25 shrink-0">
              <Database size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-text-hi">Notatki z Notion</div>
              <div className="text-[11px] text-content-muted mt-0.5">
                {fromNotion > 0
                  ? `${fromNotion} ${fromNotion === 1 ? 'lekcja' : 'lekcji'}${
                      lastNotion ? ` · ostatnia ${lastNotion}` : ''
                    }${studentName ? ` · ${studentName}` : ''}`
                  : 'Nic jeszcze nie zaimportowane'}
              </div>
              <p className="text-[11px] text-content-muted mt-1.5 leading-relaxed">
                Pobieranie i porządkowanie siedzi w przycisku „Lekcje" nad listą — tam, gdzie
                cała reszta czynności na historii.
              </p>
            </div>
          </div>

          {/* ── Transkrypcje: źródło pchane, więc nie ma czego klikać ── */}
          <div className="rounded-xl border border-line-strong bg-base-100/50 p-3.5 flex items-start gap-2.5">
            <span className="p-2 rounded-lg bg-primary/12 text-primary border border-primary/25 shrink-0">
              <Mic size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-text-hi">Transkrypcje z Cribro Sift</div>
              <div className="text-[11px] text-content-muted mt-0.5">
                {fromTranscript > 0
                  ? `${fromTranscript} ${fromTranscript === 1 ? 'lekcja' : 'lekcji'}`
                  : 'Nic jeszcze nie przysłane'}
              </div>
              <p className="text-[11px] text-content-muted mt-1.5 leading-relaxed">
                {awaitingTeacher > 0 ? (
                  <span className="text-primary font-bold">
                    {awaitingTeacher}{' '}
                    {awaitingTeacher === 1 ? 'transkrypcja czeka' : 'transkrypcje czekają'} na
                    wygenerowanie bloków — otwórz lekcję niżej.
                  </span>
                ) : (
                  'Przychodzą same po wysłaniu z Sifta. Nie ma tu czego klikać.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonSourceBar;
