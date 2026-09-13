import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord } from '../../types';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { extractLessonBlocks } from '../../utils/lessonBlocks';
import {
  generatePreLessonBriefing,
  PreLessonBriefing,
} from '../../services/preLessonBriefing';
import {
  getStudentWeaknessItems,
  WeaknessItem,
} from '../../services/studentContext';

/**
 * Kontekst kursanta przed lekcją — „Co ostatnio robiliśmy i co dalej?".
 *
 * ══ CO SIĘ TU ZMIENIŁO I DLACZEGO ══
 *
 * Pierwsza wersja pokazywała surowe bloki lekcji: streszczenie, wklej
 * słownictwa i pole „do poprawy", w którym potrafiło siedzieć całe zadanie
 * domowe razem z kluczem odpowiedzi. Formalnie był tam komplet informacji;
 * praktycznie był to zrzut bazy, który trzeba było przeczytać w całości, żeby
 * się dowiedzieć, że nic ważnego w nim nie ma. Ekran, który miał oszczędzać
 * minutę przed lekcją, tę minutę zabierał.
 *
 * Teraz na wierzchu stoi ODPRAWA ułożona przez model z trzech ostatnich
 * lekcji (`services/preLessonBriefing.ts`) — podzielona dokładnie tak, jak
 * lektor o tym myśli: co się działo, o czym mówił kursant, jakie słowa padły,
 * co zadałem, co się chwieje, co zrobić dzisiaj. Surowe notatki nie znikają:
 * leżą pod spodem, zwinięte, dla tych kilku razy, kiedy trzeba sprawdzić
 * dokładne brzmienie zapisu.
 *
 * Odprawa liczy się sama przy otwarciu i jest buforowana do czasu, aż dojdzie
 * nowa lekcja. Ekran ma być ułatwiaczem, więc nie zaczyna się od przycisku,
 * który trzeba nacisnąć, żeby cokolwiek zobaczyć.
 */

interface PreLessonContextProps {
  studentId: string;
  studentName: string;
  /**
   * Lekcje kursanta. Opcjonalne: gdy ekran otwiera się z kafelka panelu, a nie
   * z profilu kursanta, nikt ich wcześniej nie wczytał — wtedy komponent
   * dociąga je sam po `studentId`.
   */
  lessonRecords?: LessonRecord[];
  /** Przejście do pełnego wpisu lekcji w zakładce historii. */
  onOpenHistory?: () => void;
}

/** Ile dni minęło od daty w formacie zapisanym w `LessonRecord.date`. */
const daysSince = (date: string): number | null => {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24)));
};

const formatGap = (days: number | null): string => {
  if (days === null) return 'data nieczytelna';
  if (days === 0) return 'dzisiaj';
  if (days === 1) return 'wczoraj';
  return `${days} dni temu`;
};

/**
 * Jedna sekcja odprawy. Wszystkie wyglądają tak samo — różni je ikona, tytuł
 * i barwa sygnału; dzięki temu oko przeskakuje między nimi, zamiast czytać
 * każdą od nowa.
 */
const BriefingSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  tone?: 'neutral' | 'danger' | 'warn';
  items: string[];
  emptyLabel?: string;
}> = ({ icon, title, tone = 'neutral', items, emptyLabel }) => {
  if (items.length === 0 && !emptyLabel) return null;

  const accent =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warn'
      ? 'text-warn'
      : 'text-primary';

  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
        <span className={accent}>{icon}</span>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-content-muted px-1">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-start gap-2.5 text-sm text-content leading-relaxed"
            >
              <span className={`mt-[0.55em] h-1.5 w-1.5 rounded-full shrink-0 ${
                tone === 'danger' ? 'bg-danger' : tone === 'warn' ? 'bg-warn' : 'bg-primary'
              }`} />
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Zwijany blok z surową notatką — dokładnie to, co lektor wpisał. */
const RawBlock: React.FC<{ title: string; body: string }> = ({ title, body }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!body || !body.trim()) return null;

  return (
    <div className="rounded-xl border border-line bg-base-200/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-xs font-semibold text-text-2">{title}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-content-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-3.5 pb-3.5 text-[13px] text-content leading-relaxed whitespace-pre-wrap border-t border-line-soft pt-3">
          {body.trim()}
        </div>
      )}
    </div>
  );
};

const PreLessonContext: React.FC<PreLessonContextProps> = ({
  studentId,
  studentName,
  lessonRecords,
  onOpenHistory,
}) => {
  const [fetchedRecords, setFetchedRecords] = useState<LessonRecord[] | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [weaknesses, setWeaknesses] = useState<WeaknessItem[]>([]);
  const [briefing, setBriefing] = useState<PreLessonBriefing | null>(null);
  const [briefingState, setBriefingState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [briefingError, setBriefingError] = useState<string>('');

  // Dociągnięcie lekcji tylko wtedy, gdy panel ich nie podał — inaczej
  // dublowalibyśmy zapytanie, które i tak już poszło.
  useEffect(() => {
    if (lessonRecords) {
      setFetchedRecords(null);
      return;
    }
    let cancelled = false;
    setLoadingRecords(true);
    getLessonRecordsForStudent(studentId)
      .then(res => {
        if (!cancelled) setFetchedRecords(res);
      })
      .catch(err => {
        console.warn('[Kontekst] Nie udało się pobrać lekcji kursanta:', err?.message || err);
        if (!cancelled) setFetchedRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecords(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, lessonRecords]);

  const records = lessonRecords ?? fetchedRecords ?? [];

  // `getLessonRecordsForStudent` sortuje malejąco po dacie, ale ekran nie może
  // na tym polegać — panel przekazuje tablicę, którą mógł po drodze przefiltrować.
  const sorted = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
      ),
    [records]
  );

  const lastLesson = sorted[0] || null;
  const blocks = useMemo(
    () => (lastLesson ? extractLessonBlocks(lastLesson) : null),
    [lastLesson]
  );

  useEffect(() => {
    let cancelled = false;
    getStudentWeaknessItems(studentId)
      .then(res => {
        if (!cancelled) setWeaknesses(res);
      })
      .catch(() => {
        /* brak danych o błędach nie jest błędem ekranu */
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const runBriefing = useCallback(
    async (force: boolean) => {
      if (sorted.length === 0) return;
      setBriefingState('loading');
      setBriefingError('');
      try {
        const result = await generatePreLessonBriefing(studentName, sorted, { force });
        setBriefing(result);
        setBriefingState('idle');
      } catch (err: any) {
        console.error('[Kontekst] Odprawa AI nie powstała:', err);
        setBriefingError(err?.message || 'Model nie odpowiedział.');
        setBriefingState('error');
      }
    },
    [sorted, studentName]
  );

  // Odprawa startuje sama, gdy tylko są lekcje — i tylko raz na komplet lekcji.
  useEffect(() => {
    if (sorted.length === 0) return;
    setBriefing(null);
    runBriefing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted[0]?.id]);

  if (!lastLesson && loadingRecords) {
    return (
      <div className="p-10 flex items-center justify-center gap-2 text-sm text-content-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Wczytywanie kontekstu…
      </div>
    );
  }

  if (!lastLesson) {
    return (
      <div className="p-6 rounded-2xl bg-base-200/50 border border-line text-center">
        <CalendarClock className="w-8 h-8 text-content-muted mx-auto mb-3" />
        <p className="text-content font-semibold">Brak zapisanych lekcji</p>
        <p className="text-sm text-content-muted mt-1">
          Kontekst pojawi się, gdy zapiszesz pierwszą lekcję z {studentName}.
        </p>
      </div>
    );
  }

  const gap = daysSince(lastLesson.date || lastLesson.createdAt);

  /* Błędy z bazy dokładają się do tego, co model wyczytał z notatek: notatki
     mówią, co lektor zauważył na lekcji, a `weaknesses` — co kursant realnie
     mylił w ćwiczeniach między lekcjami. To dwa różne źródła tej samej rzeczy. */
  const watchOut = [
    ...(briefing?.watchOut || []),
    ...weaknesses.map(w =>
      w.source === 'collection' && w.frequency > 1
        ? `${w.name} — mylone ${w.frequency}× w ćwiczeniach`
        : w.name
    ),
  ];

  return (
    <div className="space-y-4">
      {/* Nagłówek — gdzie skończyliśmy i ile temu. */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-primary/[0.06] border border-primary/20">
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-bold tracking-wider text-content-muted font-mono">
            Ostatnia lekcja
          </div>
          <div className="text-base sm:text-lg font-extrabold text-text-hi mt-0.5 truncate">
            {lastLesson.topic || 'Bez tematu'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-sm text-primary font-bold">{lastLesson.date}</div>
          <div className="text-xs text-content-muted">
            {formatGap(gap)} · {sorted.length} {sorted.length === 1 ? 'lekcja' : 'lekcji'} w historii
          </div>
        </div>
      </div>

      {/* ODPRAWA — to jest właściwa treść ekranu. */}
      <div className="rounded-2xl border border-line-strong bg-base-200/60 overflow-hidden">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-line-soft bg-base-300/40">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={14} className="text-primary shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-2 truncate">
              Odprawa z {Math.min(3, sorted.length)} ostatnich lekcji
            </span>
          </div>
          <button
            type="button"
            onClick={() => runBriefing(true)}
            disabled={briefingState === 'loading'}
            title="Ułóż odprawę od nowa"
            className="shrink-0 h-7 px-2.5 rounded-lg border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            <RefreshCw size={12} className={briefingState === 'loading' ? 'animate-spin' : ''} />
            Odśwież
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {briefingState === 'loading' && !briefing ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-content-muted">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Układam odprawę z ostatnich lekcji…</span>
            </div>
          ) : briefingState === 'error' && !briefing ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-content-muted">
                Odprawa się nie ułożyła: {briefingError}
              </p>
              <p className="text-xs text-content-muted">
                Surowe notatki z lekcji są niżej — nic nie przepadło.
              </p>
            </div>
          ) : briefing ? (
            <div className="space-y-5">
              {briefing.headline && (
                <p className="text-sm sm:text-[15px] text-text-hi font-semibold leading-relaxed">
                  {briefing.headline}
                </p>
              )}

              <BriefingSection
                icon={<CalendarClock size={13} />}
                title="Co się działo"
                items={briefing.covered}
              />

              <BriefingSection
                icon={<MessageSquareQuote size={13} />}
                title="O czym mówił kursant"
                items={briefing.studentVoice}
              />

              {briefing.vocabulary.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                    <BookMarked size={13} className="text-primary" />
                    Słowa, które padły
                  </h3>
                  {/* Słownictwo jako żetony, nie jako lista: hasła są krótkie,
                      a w pionowej liście dwanaście pozycji zajmuje pół ekranu
                      i wygląda na dłuższe, niż jest. */}
                  <div className="flex flex-wrap gap-1.5">
                    {briefing.vocabulary.map((item, index) => (
                      <span
                        key={`${item.term}-${index}`}
                        title={item.note || undefined}
                        className="px-2.5 py-1 rounded-lg bg-base-300/60 border border-line text-xs text-content"
                      >
                        <strong className="text-text-hi font-semibold">{item.term}</strong>
                        {item.note && (
                          <span className="text-content-muted"> · {item.note}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <BriefingSection
                icon={<ClipboardList size={13} />}
                title="Co zadałem"
                items={briefing.homework}
                emptyLabel="Nic nie zostało zadane po ostatnich lekcjach."
              />

              <BriefingSection
                icon={<AlertCircle size={13} />}
                title="Co się chwieje"
                tone="danger"
                items={watchOut}
                emptyLabel="Brak powtarzalnych błędów w notatkach i ćwiczeniach."
              />

              {briefing.nextStep.length > 0 && (
                <section className="space-y-2 pt-1">
                  <h3 className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                    <Target size={13} className="text-warn" />
                    Na dzisiaj
                  </h3>
                  <ol className="space-y-1.5 p-3.5 rounded-xl bg-warn/[0.07] border border-warn/20">
                    {briefing.nextStep.map((step, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-sm text-content leading-relaxed">
                        <span className="font-mono text-[11px] text-warn font-bold pt-[0.25em] shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0">{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Surowe notatki — zwinięte. Odprawa jest streszczeniem, a streszczenie
          zawsze coś gubi; to jest miejsce, w którym można sprawdzić dokładne
          brzmienie zapisu, bez stawiania go przed odprawą. */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-content-muted uppercase tracking-wider px-1">
          Notatki z ostatniej lekcji — dokładny zapis
        </h3>
        <div className="space-y-1.5">
          {blocks?.summary && (
            <div className="rounded-xl border border-line bg-base-200/40 overflow-hidden">
              <details>
                <summary className="px-3.5 py-2.5 text-xs font-semibold text-text-2 cursor-pointer hover:bg-white/[0.03] transition-colors list-none flex items-center justify-between">
                  Przebieg lekcji
                  <ChevronDown size={14} className="text-content-muted" />
                </summary>
                <div className="px-3.5 pb-3.5 pt-3 border-t border-line-soft text-[13px] text-content markdown-body prose prose-sm prose-headings:text-text-hi prose-strong:text-text-hi max-w-none">
                  <Markdown>{blocks.summary}</Markdown>
                </div>
              </details>
            </div>
          )}
          <RawBlock title="Wypowiedzi kursanta" body={lastLesson.studentSpeaking || ''} />
          <RawBlock title="Słownictwo — wklej z lekcji" body={blocks?.vocabulary || ''} />
          <RawBlock
            title="Błędy i poprawki"
            body={blocks?.corrections || lastLesson.thingsToImprove || ''}
          />
          <RawBlock title="Praca domowa" body={blocks?.homework || ''} />
          <RawBlock title="Klucz odpowiedzi" body={blocks?.answerKey || ''} />
          <RawBlock
            title="Plan na kolejną lekcję"
            body={blocks?.nextLesson || lastLesson.suggestedFollowUp || ''}
          />
        </div>
      </div>

      {onOpenHistory && (
        <button
          onClick={onOpenHistory}
          className="text-xs font-bold text-primary hover:underline px-1 cursor-pointer"
        >
          Otwórz pełną historię lekcji →
        </button>
      )}
    </div>
  );
};

export default PreLessonContext;
