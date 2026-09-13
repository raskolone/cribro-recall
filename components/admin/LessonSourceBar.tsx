import React from 'react';
import { Database, Mic, RefreshCw } from 'lucide-react';
import { LessonRecord } from '../../types';
import Button from '../ui/Button';

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
 * ══ DWA ŹRÓDŁA, DWIE RÓŻNE CZYNNOŚCI ══
 *
 * Notion jest źródłem CIĄGNIONYM: aplikacja pyta, kiedy lektor każe, więc
 * ma przycisk. Transkrypcje są źródłem PCHANYM: przychodzą same z aplikacji
 * nagrywającej i nie ma czego kliknąć — jest tylko stan „tyle już przyszło".
 * Dawanie im obu takiego samego przycisku sugerowałoby, że transkrypcję da
 * się „zsynchronizować", a nie da: ona albo została wysłana z Sifta, albo nie.
 *
 * Trzeciego źródła jeszcze nie ma. Ten pasek jest miejscem, w którym się
 * pojawi — nie listą rozwijaną z jedną pozycją, która udaje wybór.
 */

interface LessonSourceBarProps {
  lessons: LessonRecord[];
  studentName?: string;
  /** Odpalenie synchronizacji z Notion dla tego kursanta. */
  onSyncNotion: () => void;
}

const LessonSourceBar: React.FC<LessonSourceBarProps> = ({
  lessons,
  studentName,
  onSyncNotion,
}) => {
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
    <section className="rounded-2xl border border-line-strong bg-base-200/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-content-muted">
          Źródło historii lekcji
        </h4>
        <span className="text-[11px] font-mono text-content-muted">
          {lessons.length} {lessons.length === 1 ? 'lekcja' : 'lekcji'}
          {studentName ? ` · ${studentName}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* ── Notion: źródło ciągnione, więc z przyciskiem ── */}
        <div className="rounded-xl border border-line-strong bg-base-100/50 p-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <span className="p-2 rounded-lg bg-primary/12 text-primary border border-primary/25 shrink-0">
              <Database size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-text-hi">Notatki z Notion</div>
              <div className="text-[11px] text-content-muted mt-0.5">
                {fromNotion > 0
                  ? `${fromNotion} ${fromNotion === 1 ? 'lekcja' : 'lekcji'}${lastNotion ? ` · ostatnia ${lastNotion}` : ''}`
                  : 'Nic jeszcze nie zaimportowane'}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onSyncNotion}
            className="w-full flex items-center justify-center gap-1.5 font-bold border-line-strong hover:border-primary/50"
            title="Sprawdź bazę Notion i zsynchronizuj lekcje tego kursanta"
          >
            <RefreshCw size={13} className="text-primary" />
            Sprawdź Notion
          </Button>
        </div>

        {/* ── Transkrypcje: źródło pchane, więc bez przycisku ── */}
        <div className="rounded-xl border border-line-strong bg-base-100/50 p-3.5 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
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
            </div>
          </div>
          <p className="text-[11px] text-content-muted leading-relaxed">
            {awaitingTeacher > 0 ? (
              // Kolor jako sygnał stanu: to jedyna rzecz w tym pasku, która
              // czeka na czynność lektora.
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

      {manual > 0 && (
        <p className="text-[11px] text-content-muted">
          Poza tym {manual} {manual === 1 ? 'lekcja wpisana' : 'lekcji wpisanych'} ręcznie
          albo wygenerowanych w panelu.
        </p>
      )}
    </section>
  );
};

export default LessonSourceBar;
