import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookMarked, CalendarClock, Loader2, Sparkles, Target } from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord } from '../../types';
import { parseVocabularyTextToCards } from '../../services/lessonRecord';
import {
  getApprovedItemsForLesson,
  getStudentWeaknessItems,
  WeaknessItem,
} from '../../services/studentContext';

/**
 * Kontekst kursanta przed lekcją — „Co ostatnio robiliśmy i co dalej?".
 *
 * Ekran nic nie wylicza od nowa: streszczenie, elementy i błędy leżą w bazie
 * od dawna, tylko były rozrzucone po historii lekcji i po promptach AI.
 * To jest jedno miejsce, które je zbiera, żeby dało się je otworzyć na minutę
 * przed zajęciami zamiast klikać przez profil → historia → właściwy wpis.
 *
 * Lekcje przychodzą z panelu (`lessonRecords`), bo są tam już wczytane —
 * własnym odczytem dublowalibyśmy zapytanie. Dociągamy tylko `weaknesses`,
 * których panel nie pobiera.
 */

interface PreLessonContextProps {
  studentId: string;
  studentName: string;
  lessonRecords: LessonRecord[];
  /** Przejście do pełnego wpisu lekcji w zakładce historii. */
  onOpenHistory?: () => void;
}

/** Ile dni minęło od daty w formacie zapisanym w `LessonRecord.date`. */
const daysSince = (date: string): number | null => {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return null;
  const diff = Date.now() - then.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const formatGap = (days: number | null): string => {
  if (days === null) return 'data nieczytelna';
  if (days === 0) return 'dzisiaj';
  if (days === 1) return 'wczoraj';
  if (days < 5) return `${days} dni temu`;
  if (days < 22) return `${days} dni temu`;
  return `${days} dni temu`;
};

const PreLessonContext: React.FC<PreLessonContextProps> = ({
  studentId,
  studentName,
  lessonRecords,
  onOpenHistory,
}) => {
  const [weaknesses, setWeaknesses] = useState<WeaknessItem[]>([]);
  const [loadingWeaknesses, setLoadingWeaknesses] = useState(true);
  const [showAllItems, setShowAllItems] = useState(false);
  /** `null` = lekcja sprzed wprowadzenia zatwierdzania; pokazujemy cały wklej. */
  const [approvedItems, setApprovedItems] = useState<string[] | null>(null);

  // `getLessonRecordsForStudent` sortuje malejąco po dacie, ale ekran nie może
  // na tym polegać — panel przekazuje tablicę, którą mógł po drodze przefiltrować.
  const lastLesson = useMemo(() => {
    if (!lessonRecords || lessonRecords.length === 0) return null;
    return [...lessonRecords].sort(
      (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
    )[0];
  }, [lessonRecords]);

  const items = useMemo(() => {
    if (approvedItems && approvedItems.length > 0) {
      return parseVocabularyTextToCards(approvedItems.join('\n'));
    }
    return lastLesson?.vocabularyText ? parseVocabularyTextToCards(lastLesson.vocabularyText) : [];
  }, [lastLesson, approvedItems]);

  useEffect(() => {
    let cancelled = false;
    setApprovedItems(null);
    getApprovedItemsForLesson(studentId, lastLesson?.vocabularySetId).then((res) => {
      if (!cancelled) setApprovedItems(res);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, lastLesson?.vocabularySetId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingWeaknesses(true);
    getStudentWeaknessItems(studentId)
      .then((res) => {
        if (!cancelled) setWeaknesses(res);
      })
      .finally(() => {
        if (!cancelled) setLoadingWeaknesses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!lastLesson) {
    return (
      <div className="p-6 rounded-2xl bg-base-200/50 border border-white/10 text-center">
        <CalendarClock className="w-8 h-8 text-content-muted mx-auto mb-3" />
        <p className="text-content font-semibold">Brak zapisanych lekcji</p>
        <p className="text-sm text-content-muted mt-1">
          Kontekst pojawi się, gdy zapiszesz pierwszą lekcję z {studentName}.
        </p>
      </div>
    );
  }

  const gap = daysSince(lastLesson.date || lastLesson.createdAt);
  const visibleItems = showAllItems ? items : items.slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
        <div>
          <div className="text-xs uppercase font-bold tracking-wider text-content-muted font-mono">
            Ostatnia lekcja
          </div>
          <div className="text-lg font-extrabold text-white mt-0.5">{lastLesson.topic}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-primary font-bold">{lastLesson.date}</div>
          <div className="text-xs text-content-muted">{formatGap(gap)}</div>
        </div>
      </div>

      {lastLesson.lessonSummary && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Streszczenie
          </h3>
          <div className="bg-base-200/50 border border-white/10 rounded-2xl p-5 text-content text-sm markdown-body prose prose-invert max-w-none">
            <Markdown>{lastLesson.lessonSummary}</Markdown>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-primary" /> Najważniejsze elementy
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-content-muted px-1">Ta lekcja nie ma zapisanego słownictwa.</p>
        ) : (
          <>
            <ol className="space-y-2">
              {visibleItems.map((item, idx) => (
                <li
                  key={`${item.term}-${idx}`}
                  className="flex items-start gap-3 p-3 rounded-xl bg-base-200/50 border border-white/10"
                >
                  <span className="font-mono text-xs text-primary font-bold pt-0.5 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm text-content">
                    <span className="font-bold text-white">{item.term}</span>
                    {item.definition && <span className="text-content-muted"> — {item.definition}</span>}
                  </span>
                </li>
              ))}
            </ol>
            {items.length > 3 && (
              <button
                onClick={() => setShowAllItems((v) => !v)}
                className="text-xs font-bold text-primary hover:underline px-1"
              >
                {showAllItems ? 'Pokaż tylko trzy pierwsze' : `Pokaż wszystkie (${items.length})`}
              </button>
            )}
            {/* Kolejność jest ta z zapisu lekcji — zatwierdzanie mówi, *które*
                pozycje wchodzą do powtórek, ale nie ustawia ich ważności.
                Lepiej to napisać wprost, niż udawać ranking, którego nie ma. */}
            <p className="text-xs text-content-muted px-1 pt-1">
              {approvedItems && approvedItems.length > 0
                ? 'Pozycje zatwierdzone po tej lekcji, w kolejności z zapisu.'
                : 'Cały wklej z lekcji — ta lekcja jest sprzed wprowadzenia zatwierdzania.'}
            </p>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-danger" /> Elementy niestabilne
        </h3>
        {loadingWeaknesses ? (
          <div className="flex items-center gap-2 text-sm text-content-muted px-1">
            <Loader2 className="w-4 h-4 animate-spin" /> Wczytywanie…
          </div>
        ) : weaknesses.length === 0 ? (
          <p className="text-sm text-content-muted px-1">
            Brak zarejestrowanych błędów — dane zbierają się z ćwiczeń kursanta.
          </p>
        ) : (
          <ul className="space-y-2">
            {weaknesses.map((w) => (
              <li
                key={w.id}
                className="flex items-start justify-between gap-3 p-3 rounded-xl bg-danger/5 border border-danger/20"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">{w.name}</div>
                  {w.description && (
                    <div className="text-xs text-content-muted mt-0.5">{w.description}</div>
                  )}
                </div>
                {w.source === 'collection' && (
                  <span className="shrink-0 font-mono text-xs text-danger font-bold px-2 py-0.5 rounded-md bg-danger/10 border border-danger/30">
                    ×{w.frequency}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(lastLesson.thingsToImprove || lastLesson.suggestedFollowUp) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {lastLesson.thingsToImprove && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider">Do poprawy</h3>
              <div className="bg-base-200/50 border border-white/10 rounded-2xl p-4 text-sm text-content whitespace-pre-wrap">
                {lastLesson.thingsToImprove}
              </div>
            </div>
          )}
          {lastLesson.suggestedFollowUp && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-warn" /> Następny krok
              </h3>
              <div className="bg-warn/5 border border-warn/20 rounded-2xl p-4 text-sm text-content whitespace-pre-wrap">
                {lastLesson.suggestedFollowUp}
              </div>
            </div>
          )}
        </section>
      )}

      {onOpenHistory && (
        <button
          onClick={onOpenHistory}
          className="text-xs font-bold text-primary hover:underline px-1"
        >
          Otwórz pełną historię lekcji →
        </button>
      )}
    </div>
  );
};

export default PreLessonContext;
