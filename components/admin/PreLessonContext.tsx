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
  Target,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord } from '../../types';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { extractLessonBlocks } from '../../utils/lessonBlocks';
import {
  generatePreLessonBriefing,
  BriefingLesson,
  BriefingScope,
  PreLessonBriefing,
} from '../../services/preLessonBriefing';
import {
  getStudentWeaknessItems,
  WeaknessItem,
} from '../../services/studentContext';
import { sanitizeBriefingHeadline, toPolishVocative } from '../../utils/polishVocative';
import { formatStudentFirstName } from '../../utils/studentFormat';

/**
 * Kontekst kursanta przed lekcją — „Co ostatnio robiliśmy i co dalej?".
 *
 * ══ CAŁOŚĆ W ZWIJANYCH SEKCJACH ══
 *
 * Na wierzchu stoi jeden akapit do lektora po imieniu i nic więcej; wszystko
 * pozostałe jest zwinięte. To jest różnica między ściągawką a raportem:
 * ściągawkę czyta się w kilkanaście sekund i rozwija tylko to jedno miejsce,
 * o które akurat chodzi. Poprzednia wersja pokazywała naraz sześć sekcji list
 * i wychodziła z tego strona tekstu — czyli znowu coś, co trzeba przeczytać
 * w całości, żeby się dowiedzieć, czego się nie potrzebowało.
 *
 * Rozwinięta startuje wyłącznie najnowsza lekcja. Starsze są od tego, żeby
 * do nich sięgnąć, a nie żeby je czytać za każdym razem.
 */

interface PreLessonContextProps {
  studentId: string;
  studentName: string;
  /** Imię lektora — odprawa zwraca się do niego wprost. */
  teacherName: string;
  /** Ile ostatnich lekcji wchodzi do odprawy. Wybrane przy kliknięciu kafelka. */
  scope: BriefingScope;
  onScopeChange?: (scope: BriefingScope) => void;
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
  if (days === null) return '';
  if (days === 0) return 'dzisiaj';
  if (days === 1) return 'wczoraj';
  return `${days} dni temu`;
};

/**
 * Zwijane okienko — jeden kształt dla wszystkiego, co nie jest akapitem
 * otwierającym. Stan trzyma wywołujący, żeby dało się otworzyć najnowszą
 * lekcję i zostawić resztę zamkniętą.
 */
const Fold: React.FC<{
  title: React.ReactNode;
  meta?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  tone?: 'neutral' | 'danger' | 'warn';
  children: React.ReactNode;
}> = ({ title, meta, isOpen, onToggle, tone = 'neutral', children }) => (
  <div
    className={`rounded-xl border overflow-hidden transition-colors ${
      tone === 'danger'
        ? 'border-danger/25 bg-danger/[0.04]'
        : tone === 'warn'
        ? 'border-warn/25 bg-warn/[0.05]'
        : 'border-line-strong bg-base-200/50'
    }`}
  >
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="w-full px-3.5 py-3 flex items-center gap-2.5 text-left cursor-pointer hover:bg-white/[0.03] transition-colors"
    >
      <ChevronDown
        size={15}
        className={`shrink-0 text-content-muted transition-transform ${isOpen ? '' : '-rotate-90'}`}
      />
      <span className="min-w-0 flex-1 text-sm font-bold text-text-hi truncate">{title}</span>
      {meta && <span className="shrink-0 text-[11px] text-content-muted font-mono">{meta}</span>}
    </button>
    {isOpen && <div className="px-3.5 pb-3.5 pt-0.5 space-y-4">{children}</div>}
  </div>
);

/** Lista punktów pod krótkim nagłówkiem. Nic nie rysuje, gdy jest pusta. */
const Points: React.FC<{
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone?: 'neutral' | 'danger' | 'warn';
}> = ({ icon, title, items, tone = 'neutral' }) => {
  if (items.length === 0) return null;
  const dot = tone === 'danger' ? 'bg-danger' : tone === 'warn' ? 'bg-warn' : 'bg-primary';
  const accent = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-primary';

  return (
    <section className="space-y-1.5">
      <h4 className="text-[10px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1.5">
        <span className={accent}>{icon}</span>
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="flex items-start gap-2 text-[13px] text-content leading-relaxed"
          >
            <span className={`mt-[0.55em] h-1 w-1 rounded-full shrink-0 ${dot}`} />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
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

const SCOPE_LABELS: Record<BriefingScope, string> = {
  1: 'Ostatnia',
  2: '2 ostatnie',
  3: '3 ostatnie',
};

const PreLessonContext: React.FC<PreLessonContextProps> = ({
  studentId,
  studentName,
  teacherName,
  scope,
  onScopeChange,
  lessonRecords,
  onOpenHistory,
}) => {
  const [fetchedRecords, setFetchedRecords] = useState<LessonRecord[] | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [weaknesses, setWeaknesses] = useState<WeaknessItem[]>([]);
  const [briefing, setBriefing] = useState<PreLessonBriefing | null>(null);
  const [briefingState, setBriefingState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [briefingError, setBriefingError] = useState<string>('');
  /** Które okienka są rozwinięte. Domyślnie tylko najnowsza lekcja. */
  const [openFolds, setOpenFolds] = useState<Record<string, boolean>>({ 'lesson-0': true });
  const [showRawNotes, setShowRawNotes] = useState(false);

  const toggleFold = (id: string) =>
    setOpenFolds(prev => ({ ...prev, [id]: !prev[id] }));

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
        const result = await generatePreLessonBriefing(
          teacherName,
          studentName,
          sorted,
          scope,
          { force }
        );
        setBriefing(result);
        setBriefingState('idle');
      } catch (err: any) {
        console.error('[Kontekst] Odprawa AI nie powstała:', err);
        setBriefingError(err?.message || 'Model nie odpowiedział.');
        setBriefingState('error');
      }
    },
    [sorted, teacherName, studentName, scope]
  );

  // Odprawa startuje sama — i liczy się od nowa po zmianie zakresu.
  useEffect(() => {
    if (sorted.length === 0) return;
    setBriefing(null);
    setOpenFolds({ 'lesson-0': true });
    runBriefing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted[0]?.id, scope]);

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

  const availableScopes = ([1, 2, 3] as BriefingScope[]).filter(
    value => value === 1 || sorted.length >= value
  );

  const renderLesson = (lesson: BriefingLesson, index: number) => {
    const gap = formatGap(daysSince(lesson.date));
    return (
      <Fold
        key={`lesson-${index}`}
        isOpen={!!openFolds[`lesson-${index}`]}
        onToggle={() => toggleFold(`lesson-${index}`)}
        title={lesson.topic}
        meta={[lesson.date, gap].filter(Boolean).join(' · ')}
      >
        <Points
          icon={<CalendarClock size={12} />}
          title="Co się działo"
          items={lesson.covered}
        />
        <Points
          icon={<MessageSquareQuote size={12} />}
          title="O czym mówił kursant"
          items={lesson.studentVoice}
        />
        {lesson.vocabulary.length > 0 && (
          <section className="space-y-1.5">
            <h4 className="text-[10px] font-bold text-content-muted uppercase tracking-wider flex items-center gap-1.5">
              <BookMarked size={12} className="text-primary" />
              Jakie słowa padły
            </h4>
            {/* Żetony, nie lista: hasła są krótkie, a w pionie dziesięć pozycji
                zajmuje pół ekranu i wygląda na dłuższe, niż jest. */}
            <div className="flex flex-wrap gap-1.5">
              {lesson.vocabulary.map((item, idx) => (
                <span
                  key={`${item.term}-${idx}`}
                  title={item.note || undefined}
                  className="px-2 py-0.5 rounded-md bg-base-300/60 border border-line text-[12px] text-content"
                >
                  <strong className="text-text-hi font-semibold">{item.term}</strong>
                  {item.note && <span className="text-content-muted"> · {item.note}</span>}
                </span>
              ))}
            </div>
          </section>
        )}
        <Points
          icon={<ClipboardList size={12} />}
          title="Co zadałem"
          items={lesson.homework}
        />
      </Fold>
    );
  };

  return (
    <div className="space-y-3">
      {/* ZAKRES — pierwsza decyzja, więc pierwsza rzecz na ekranie. */}
      {onScopeChange && availableScopes.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
            Kontekst z
          </span>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-base-300/50 border border-line">
            {availableScopes.map(value => (
              <button
                key={value}
                type="button"
                onClick={() => onScopeChange(value)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  scope === value
                    ? 'bg-primary text-accent-ink'
                    : 'text-content-muted hover:text-text-hi'
                }`}
              >
                {SCOPE_LABELS[value]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => runBriefing(true)}
            disabled={briefingState === 'loading'}
            title="Ułóż odprawę od nowa"
            className="ml-auto h-7 px-2.5 rounded-lg border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            <RefreshCw size={12} className={briefingState === 'loading' ? 'animate-spin' : ''} />
            Odśwież
          </button>
        </div>
      )}

      {briefingState === 'loading' && !briefing ? (
        <div className="py-10 flex flex-col items-center justify-center gap-2 text-sm text-content-muted">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span>Układam odprawę…</span>
        </div>
      ) : briefingState === 'error' && !briefing ? (
        <div className="py-6 px-4 rounded-xl border border-line bg-base-200/40 text-center space-y-1">
          <p className="text-sm text-content-muted">Odprawa się nie ułożyła: {briefingError}</p>
          <p className="text-xs text-content-muted">
            Surowe notatki z ostatniej lekcji są niżej — nic nie przepadło.
          </p>
        </div>
      ) : briefing ? (
        <>
          {/* AKAPIT DO LEKTORA — jedyna rzecz widoczna bez rozwijania. */}
          {briefing.headline && (
            <p className="text-sm sm:text-[15px] text-text-hi leading-relaxed px-0.5">
              {sanitizeBriefingHeadline(briefing.headline, teacherName, studentName)}
            </p>
          )}

          <div className="space-y-2">
            {briefing.lessons.map(renderLesson)}

            {watchOut.length > 0 && (
              <Fold
                tone="danger"
                isOpen={!!openFolds['watch']}
                onToggle={() => toggleFold('watch')}
                title={
                  <span className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-danger shrink-0" />
                    Co się chwieje
                  </span>
                }
                meta={`${watchOut.length}`}
              >
                <Points icon={<AlertCircle size={12} />} title="" tone="danger" items={watchOut} />
              </Fold>
            )}

            {briefing.nextStep.length > 0 && (
              <Fold
                tone="warn"
                isOpen={openFolds['next'] !== false}
                onToggle={() => setOpenFolds(prev => ({ ...prev, next: prev.next === false }))}
                title={
                  <span className="flex items-center gap-2">
                    <Target size={14} className="text-warn shrink-0" />
                    Na dzisiaj
                  </span>
                }
              >
                <ol className="space-y-1.5">
                  {briefing.nextStep.map((step, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2.5 text-[13px] text-content leading-relaxed"
                    >
                      <span className="font-mono text-[11px] text-warn font-bold pt-[0.2em] shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">{step}</span>
                    </li>
                  ))}
                </ol>
              </Fold>
            )}
          </div>
        </>
      ) : null}

      {/* Surowe notatki — całość pod jednym przyciskiem. Odprawa jest
          streszczeniem, a streszczenie zawsze coś gubi; to jest miejsce, gdzie
          można sprawdzić dokładne brzmienie zapisu, bez stawiania go przed
          odprawą. */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowRawNotes(v => !v)}
          className="text-[11px] font-bold text-content-muted hover:text-text-hi transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <ChevronDown
            size={13}
            className={`transition-transform ${showRawNotes ? '' : '-rotate-90'}`}
          />
          Notatki z ostatniej lekcji — dokładny zapis
        </button>

        {showRawNotes && (
          <div className="space-y-1.5 mt-2">
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
        )}
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
