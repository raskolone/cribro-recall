import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, History, Loader2 } from 'lucide-react';
import { LessonRecord } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { cleanVocabularyTopic } from '../../utils/vocabulary';
import { isStudentVisibleLesson } from '../../utils/lessonBlocks';
import LessonDetails from './LessonDetails';
import LessonHistoryMonths from './LessonHistoryMonths';
import PanelSection from './PanelSection';

/**
 * Lekcje kursanta: ostatnia jako wyróżniony pasek, starsze zwinięte w miesiące.
 *
 * Wszystko jest domyślnie zamknięte — panel ma się mieścić na jednym ekranie
 * telefonu i mówić, co jest do wzięcia, a nie wysypywać treść. Ostatnia lekcja
 * różni się od reszty wyłącznie światłem: ten sam zwinięty pasek, tylko
 * podświetlony neonem, żeby oko trafiało w nią bez czytania etykiet.
 *
 * Wpisy pobieramy raz i dzielimy między pasek i historię miesięczną, więc panel
 * nie odpytuje bazy dwa razy o to samo.
 */

interface StudentLessonPanelProps {
  /**
   * Który kawałek historii pokazać.
   *
   * Od przebudowy panelu na kafelki „ostatnia lekcja" stoi samodzielnie
   * (bo do niej wraca się codziennie), a „wcześniejsze lekcje" otwierają
   * się z kafelka listwy. Jeden komponent wciąż liczy jedno zapytanie do
   * bazy — rozbicie na dwa dawałoby dwa odczyty tej samej kolekcji.
   */
  only?: 'latest' | 'earlier';
  /** Bez własnego nagłówka — nagłówkiem jest kafelek listwy. */
  headless?: boolean;
  /** Czyje lekcje pokazujemy — konto kursanta, także w podglądzie lektora. */
  studentId: string;
  /**
   * `panel` — ostatnia lekcja jako wyróżniony pasek, starsze w zwiniętej sekcji.
   * `history` — same miesiące, z ostatnią lekcją włącznie.
   */
  variant?: 'panel' | 'history';
  onStudySet?: (setId: string) => void;
  onPracticeAI?: (setId: string) => void;
}

const StudentLessonPanel: React.FC<StudentLessonPanelProps> = ({
  only,
  headless,
  studentId,
  variant = 'panel',
  onStudySet,
  onPracticeAI,
}) => {
  const { language } = useLanguage();
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLatestOpen, setIsLatestOpen] = useState(false);

  useEffect(() => {
    // Odpowiedzi z Firestore przychodzą asynchronicznie; bez tej flagi zmiana
    // kursanta w podglądzie wstawiłaby do stanu lekcje poprzedniego.
    let active = true;
    setIsLoading(true);

    const load = async () => {
      if (!studentId || studentId === 'demo-id') {
        if (active) {
          setLessons([]);
          setIsLoading(false);
        }
        return;
      }
      try {
        const records = await getLessonRecordsForStudent(studentId);
        const visibleRecords = records.filter(isStudentVisibleLesson);
        if (active) setLessons(visibleRecords);
      } catch (error) {
        console.error('Nie udało się wczytać lekcji kursanta:', error);
        if (active) setLessons([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [studentId]);

  const L =
    language === 'pl'
      ? {
          lastLesson: 'Ostatnia lekcja',
          earlier: 'Wcześniejsze lekcje',
          emptyTitle: 'Pierwsza lekcja jeszcze przed Tobą',
          emptyBody:
            'Gdy lektor zapisze wpis po zajęciach, znajdziesz tu streszczenie i słownictwo z lekcji.',
          count: (n: number) => (n === 1 ? '1 lekcja' : n < 5 ? `${n} lekcje` : `${n} lekcji`),
        }
      : {
          lastLesson: 'Your last lesson',
          earlier: 'Earlier lessons',
          emptyTitle: 'Your first lesson is still ahead',
          emptyBody:
            'Once your teacher saves a record after class, the summary and vocabulary will show up here.',
          count: (n: number) => (n === 1 ? '1 lesson' : `${n} lessons`),
        };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10 text-content-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <section className="rounded-2xl border border-line-strong bg-base-200/40 p-6 text-center">
        <h2 className="text-base font-bold text-content">{L.emptyTitle}</h2>
        <p className="text-sm text-content-muted mt-2 leading-relaxed">{L.emptyBody}</p>
      </section>
    );
  }

  if (variant === 'history') {
    return (
      <LessonHistoryMonths
        lessons={lessons}
        studentId={studentId}
        onStudySet={onStudySet}
        onPracticeAI={onPracticeAI}
      />
    );
  }

  const [latest, ...earlier] = lessons;
  const latestTopic = cleanVocabularyTopic(latest.topic) || latest.topic;
  const latestDate = (() => {
    const parsed = new Date(latest.date);
    if (isNaN(parsed.getTime())) return latest.date;
    return parsed.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB', {
      day: 'numeric',
      month: 'long',
    });
  })();

  const showLatest = only !== 'earlier';
  const showEarlier = only !== 'latest';

  return (
    <div className="space-y-3">
      {/* Ostatnia lekcja: ten sam pasek co reszta, tylko rozświetlony. */}
      {showLatest && (
      <section className="neon-still rounded-2xl border border-primary/35 bg-gradient-to-b from-primary/[0.10] to-base-200/50 overflow-hidden">
        <button
          onClick={() => setIsLatestOpen((v) => !v)}
          aria-expanded={isLatestOpen}
          className="w-full min-h-[4rem] px-4 sm:px-5 py-3.5 text-left active:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
              {L.lastLesson}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-content-muted ml-auto shrink-0">
              <CalendarDays size={12} />
              {latestDate}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <h2 className="flex-1 min-w-0 text-[17px] sm:text-lg font-bold text-text-hi leading-snug">
              {latestTopic}
            </h2>
            <ChevronDown
              className={`w-4 h-4 text-primary shrink-0 transition-transform duration-200 ${
                isLatestOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isLatestOpen && (
          <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-white/[0.07]">
            <LessonDetails
              lesson={latest}
              studentId={studentId}
              onStudySet={onStudySet}
              onPracticeAI={onPracticeAI}
            />
          </div>
        )}
      </section>
      )}

      {showEarlier && earlier.length > 0 && (
        <PanelSection
          title={L.earlier}
          meta={L.count(earlier.length)}
          icon={<History size={16} />}
          headless={headless}
        >
          <LessonHistoryMonths
            lessons={earlier}
            studentId={studentId}
            openFirstMonth={false}
            flat
            onStudySet={onStudySet}
            onPracticeAI={onPracticeAI}
          />
        </PanelSection>
      )}
    </div>
  );
};

export default StudentLessonPanel;
