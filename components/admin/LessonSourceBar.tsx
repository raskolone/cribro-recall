import React, { useState } from 'react';
import { ChevronDown, Database, Mic } from 'lucide-react';
import { LessonRecord } from '../../types';

/**
 * Skąd bierze się historia lekcji tego kursanta (Transkrypcje z Sifta / Wpisy ręczne).
 */
interface LessonSourceBarProps {
  lessons: LessonRecord[];
  studentName?: string;
}

const LessonSourceBar: React.FC<LessonSourceBarProps> = ({ lessons, studentName }) => {
  const [isOpen, setIsOpen] = useState(false);

  const fromTranscript = lessons.filter((l) => l.source === 'live_transcript').length;
  const manual = lessons.filter((l) => l.source !== 'live_transcript').length;

  const awaitingTeacher = lessons.filter(
    (l) => l.source === 'live_transcript' && l.sessionStatus !== 'completed'
  ).length;

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
            Sift <strong className="text-text-hi">{fromTranscript}</strong>
          </span>
          <span className="font-mono">
            Wpisy ręczne <strong className="text-text-hi">{manual}</strong>
          </span>
          {/* Kolor jako sygnał stanu — transkrypcje czekające na lektora */}
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
          {/* ── Transkrypcje: Sift ── */}
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
                  'Przychodzą same po wysłaniu z Sifta.'
                )}
              </p>
            </div>
          </div>

          {/* ── Wpisy ręczne ── */}
          <div className="rounded-xl border border-line-strong bg-base-100/50 p-3.5 flex items-start gap-2.5">
            <span className="p-2 rounded-lg bg-primary/12 text-primary border border-primary/25 shrink-0">
              <Database size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-text-hi">Wpisy ręczne i archiwalne</div>
              <div className="text-[11px] text-content-muted mt-0.5">
                {manual > 0
                  ? `${manual} ${manual === 1 ? 'lekcja' : 'lekcji'}${studentName ? ` · ${studentName}` : ''}`
                  : 'Brak wpisów ręcznych'}
              </div>
              <p className="text-[11px] text-content-muted mt-1.5 leading-relaxed">
                Lekcje dodane ręcznie, przez asystenta AI lub zaimportowane z dokumentów.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonSourceBar;
