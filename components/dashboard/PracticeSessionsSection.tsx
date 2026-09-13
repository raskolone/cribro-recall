import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { ChevronDown, Dumbbell, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { PracticeLog } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import PanelSection from './PanelSection';

/**
 * Historia sesji ćwiczeniowych kursanta — to samo, co pokazywała zakładka
 * „Historia sesji", tylko rozwijane w miejscu zamiast w oknie modalnym.
 *
 * Okno modalne było tu kosztem bez pokrycia: na telefonie zasłania cały ekran,
 * wymaga zamknięcia i gubi miejsce, w którym kursant był. Rozwijany wiersz
 * zostawia go tam, gdzie przewinął, i działa tak samo jak reszta panelu.
 */

interface PracticeSessionsSectionProps {
  /** Bez własnego nagłówka — używane, gdy nagłówkiem jest kafelek listwy. */
  headless?: boolean;
  studentId: string;
  /** Zwinięta sekcja z własnym nagłówkiem. Wyłącz, gdy sekcją jest już zakładka. */
  asSection?: boolean;
  defaultOpen?: boolean;
}

interface NormalizedDetail {
  polish: string;
  english: string;
  studentAnswer: string;
  explanation: string;
  isCorrect?: boolean;
  score?: number | string;
}

/**
 * Sprowadza wynik sesji do jednego kształtu.
 *
 * Zapisy powstawały w kilku wersjach aplikacji i każda nazywała pola inaczej
 * (`detailedFeedback`, `sentences`, `exercisesData`, czasem string z separatorem).
 * Kolejność sprawdzania jest od najnowszego zapisu do najstarszego, żeby świeże
 * sesje nie trafiały na gorszą, uboższą gałąź.
 */
const getNormalizedDetails = (log: PracticeLog): NormalizedDetail[] => {
  if (!log) return [];

  const detailed = (log as any).detailedFeedback;
  if (Array.isArray(detailed) && detailed.length > 0) {
    return detailed.map((item: any) => ({
      polish: item.polishSentence || item.polish || '',
      english: item.correctTranslation || item.englishTranslation || item.english || '',
      studentAnswer: item.studentAnswer || '',
      explanation: item.explanation || item.feedbackRule || item.feedbackVocab || '',
      isCorrect: item.isCorrect,
      score: item.score,
    }));
  }

  if (Array.isArray(log.sentences) && log.sentences.length > 0) {
    return log.sentences.map((s: any) => ({
      polish: s.polishTranslation || s.polish_translation || s.polishSentence || '',
      english: s.englishSentence || s.english_sentence || s.englishTranslation || '',
      studentAnswer: s.studentAnswer || '',
      explanation: s.feedback || s.explanation || '',
      isCorrect: s.isCorrect,
      score: s.score,
    }));
  }

  if (Array.isArray(log.exercisesData) && log.exercisesData.length > 0) {
    return log.exercisesData.map((ex: any) => {
      if (typeof ex === 'string') {
        const parts = ex.split(' -> ');
        return { polish: parts[0] || ex, english: parts[1] || '', studentAnswer: '', explanation: '' };
      }
      return {
        polish: ex.polishSentence || ex.polish || '',
        english: ex.correctTranslation || ex.englishTranslation || ex.english || '',
        studentAnswer: ex.studentAnswer || '',
        explanation: ex.explanation || '',
        isCorrect: ex.isCorrect,
        score: ex.score,
      };
    });
  }

  if (typeof log.exercisesData === 'string' && log.exercisesData) {
    return log.exercisesData.split(' | ').map((itemStr) => {
      const parts = itemStr.split(' -> ');
      return { polish: parts[0] || itemStr, english: parts[1] || '', studentAnswer: '', explanation: '' };
    });
  }

  return [];
};

const scoreTone = (score: number): string =>
  score >= 80 ? 'text-primary' : score >= 50 ? 'text-warn' : 'text-danger';

const PracticeSessionsSection: React.FC<PracticeSessionsSectionProps> = ({
  headless,
  studentId,
  asSection = true,
  defaultOpen = false,
}) => {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const load = async () => {
      if (!studentId || studentId === 'demo-id') {
        if (active) {
          setLogs([]);
          setIsLoading(false);
        }
        return;
      }
      try {
        const snapshot = await getDocs(collection(db, `users/${studentId}/practiceLogs`));
        if (!active) return;
        const data = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as PracticeLog))
          // „Aktywność" to wpis służbowy do liczenia passy, nie sesja ćwiczeń.
          .filter((log) => (log.exerciseType as string) !== 'Aktywność')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLogs(data);
      } catch (error) {
        console.error('Nie udało się wczytać sesji ćwiczeniowych:', error);
        if (active) setLogs([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [studentId]);

  const locale = language === 'pl' ? 'pl-PL' : 'en-GB';
  const L =
    language === 'pl'
      ? {
          heading: 'Moje sesje ćwiczeń',
          empty: 'Nie masz jeszcze zapisanych sesji ćwiczeniowych.',
          items: 'Zdań',
          score: 'Wynik',
          yourAnswer: 'Twoja odpowiedź',
          feedback: 'Komentarz',
          revision: 'Powtórka',
          aiTraining: 'Trening zdań',
          flashcards: 'Fiszki',
          homework: 'Praca domowa',
          recall: 'Powtórki',
          puzzle: 'Układanka',
          typing: 'Wpisywanie',
          count: (n: number) => (n === 1 ? '1 sesja' : n < 5 ? `${n} sesje` : `${n} sesji`),
        }
      : {
          heading: 'My practice sessions',
          empty: 'No practice sessions recorded yet.',
          items: 'Items',
          score: 'Score',
          yourAnswer: 'Your answer',
          feedback: 'Feedback',
          revision: 'Revision',
          aiTraining: 'Sentence training',
          flashcards: 'Flashcards',
          homework: 'Homework',
          recall: 'Reviews',
          puzzle: 'Puzzle',
          typing: 'Typing',
          count: (n: number) => (n === 1 ? '1 session' : `${n} sessions`),
        };

  const typeLabel = (log: PracticeLog): string => {
    if (log.exerciseType === 'ai_translation') return L.aiTraining;
    if (log.exerciseType === 'flashcards') return L.flashcards;
    if ((log.exerciseType as string) === 'homework') return L.homework;
    if ((log.exerciseType as string) === 'recall') return L.recall;
    return String(log.exerciseType || '');
  };

  const formatLabel = (log: PracticeLog): string | null => {
    if (!log.exerciseFormat) return null;
    if (log.exerciseFormat === 'puzzle') return L.puzzle;
    if (log.exerciseFormat === 'typing') return L.typing;
    return log.exerciseFormat;
  };

  const body = (() => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-8 text-content-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      );
    }

    if (logs.length === 0) {
      return <p className="px-4 sm:px-5 py-5 text-sm text-content-muted">{L.empty}</p>;
    }

    return (
      <ul className="divide-y divide-white/[0.06]">
        {logs.map((log) => {
          const isOpen = openId === log.id;
          const details = isOpen ? getNormalizedDetails(log) : [];
          const date = new Date(log.date);
          const dayLabel = isNaN(date.getTime())
            ? log.date
            : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
          const hasScore =
            log.score !== undefined && log.score !== null && !isNaN(Number(log.score));

          return (
            <li key={log.id}>
              <button
                onClick={() => setOpenId(isOpen ? null : log.id)}
                aria-expanded={isOpen}
                className="w-full min-h-[3.5rem] flex items-center gap-3 px-4 sm:px-5 py-3 text-left active:bg-white/[0.04] transition-colors"
              >
                <span className="font-mono text-[11px] text-content-muted shrink-0 w-14">
                  {dayLabel}
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={`block text-[15px] leading-snug truncate ${
                      isOpen ? 'text-primary font-bold' : 'text-content font-semibold'
                    }`}
                  >
                    {typeLabel(log)}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-content-muted">
                    {formatLabel(log) && <span>{formatLabel(log)}</span>}
                    {log.setDisplayName && <span className="truncate">· {log.setDisplayName}</span>}
                    {log.isRevisionMode && <span className="text-warn">· {L.revision}</span>}
                  </span>
                </span>
                {hasScore && (
                  <span
                    className={`font-mono text-[13px] font-bold shrink-0 ${scoreTone(Number(log.score))}`}
                  >
                    {Number(log.score)}%
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-content-muted shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-5 pt-1 space-y-3">
                  <div className="flex gap-2">
                    {log.totalWords !== undefined && (
                      <div className="flex-1 rounded-xl bg-base-100/50 border border-white/[0.07] px-3 py-2.5 text-center">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-content-muted">
                          {L.items}
                        </div>
                        <div className="font-bold text-lg text-text-hi">{log.totalWords}</div>
                      </div>
                    )}
                    {hasScore && (
                      <div className="flex-1 rounded-xl bg-base-100/50 border border-white/[0.07] px-3 py-2.5 text-center">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-content-muted">
                          {L.score}
                        </div>
                        <div className={`font-bold text-lg ${scoreTone(Number(log.score))}`}>
                          {Number(log.score)}%
                        </div>
                      </div>
                    )}
                  </div>

                  {details.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-xl bg-base-100/50 border border-white/[0.07] p-3 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="prose-justified text-[14px] text-text-hi font-semibold leading-snug">
                          {item.polish}
                        </p>
                        {item.score !== undefined &&
                          item.score !== null &&
                          !isNaN(Number(item.score)) && (
                            <span
                              className={`font-mono text-[11px] font-bold shrink-0 ${scoreTone(Number(item.score))}`}
                            >
                              {Number(item.score)}%
                            </span>
                          )}
                      </div>
                      {item.english && (
                        <p className="text-[13px] text-primary/90 font-mono leading-snug">
                          {item.english}
                        </p>
                      )}
                      {item.studentAnswer && (
                        <p className="text-[13px] text-content leading-snug">
                          <span className="text-content-muted">{L.yourAnswer}: </span>
                          {item.studentAnswer}
                        </p>
                      )}
                      {item.explanation && (
                        <p className="prose-justified text-[13px] text-warn leading-relaxed">
                          <span className="text-content-muted">{L.feedback}: </span>
                          {item.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  })();

  if (!asSection) return body;

  return (
    <PanelSection
      headless={headless}
      title={L.heading}
      meta={isLoading ? undefined : L.count(logs.length)}
      icon={<Dumbbell size={16} />}
      defaultOpen={defaultOpen}
    >
      {body}
    </PanelSection>
  );
};

export default PracticeSessionsSection;
