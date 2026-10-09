import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { LessonRecord } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { cleanVocabularyTopic } from '../../utils/vocabulary';
import LessonDetails from './LessonDetails';

/**
 * Historia lekcji zwinięta do miesięcy.
 *
 * Kursant z rocznym stażem ma czterdzieści wpisów; lista czterdziestu kart na
 * telefonie to ekran, przez który się przewija, a nie czyta. Miesiąc zwija je
 * do jednego wiersza, więc cała historia mieści się na jednym ekranie i dopiero
 * dotknięcie otwiera to, czego kursant naprawdę szuka.
 *
 * W środku jest dokładnie ta sama treść co w „Ostatniej lekcji" — ten sam
 * komponent, nie druga jego wersja.
 */

interface LessonHistoryMonthsProps {
  lessons: LessonRecord[];
  studentId: string;
  /** Pierwszy miesiąc otwarty od razu — pokazuje, że wiersze się rozwijają. */
  openFirstMonth?: boolean;
  /**
   * Wariant do wnętrza innej sekcji: miesiące są wtedy wierszami listy, nie
   * osobnymi kartami. Karta w karcie w karcie robi na telefonie schodki
   * marginesów zamiast hierarchii.
   */
  flat?: boolean;
  onStudySet?: (setId: string) => void;
  onPracticeAI?: (setId: string) => void;
}

interface MonthGroup {
  key: string;
  label: string;
  lessons: LessonRecord[];
}

const LessonHistoryMonths: React.FC<LessonHistoryMonthsProps> = ({
  lessons,
  studentId,
  openFirstMonth = true,
  flat = false,
  onStudySet,
  onPracticeAI,
}) => {
  const { language } = useLanguage();
  const locale = language === 'pl' ? 'pl-PL' : 'en-GB';

  const groups = useMemo<MonthGroup[]>(() => {
    const result: MonthGroup[] = [];
    lessons.forEach((lesson) => {
      const date = new Date(lesson.date);
      const valid = !isNaN(date.getTime());
      const key = valid
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : 'unknown';
      const label = valid
        ? date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
        : language === 'pl'
        ? 'Bez daty'
        : 'No date';

      const last = result[result.length - 1];
      if (last && last.key === key) last.lessons.push(lesson);
      else result.push({ key, label, lessons: [lesson] });
    });
    return result;
  }, [lessons, locale, language]);

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(() =>
    openFirstMonth && groups[0] ? { [groups[0].key]: true } : {}
  );
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);

  const L =
    language === 'pl'
      ? { lessons: (n: number) => (n === 1 ? '1 lekcja' : n < 5 ? `${n} lekcje` : `${n} lekcji`) }
      : { lessons: (n: number) => (n === 1 ? '1 lesson' : `${n} lessons`) };

  return (
    <div className={flat ? 'divide-y divide-white/[0.06]' : 'space-y-2.5'}>
      {groups.map((group) => {
        const isMonthOpen = openMonths[group.key] === true;
        return (
          <section
            key={group.key}
            className={
              flat
                ? ''
                : 'rounded-2xl border border-white/10 bg-base-200/40 overflow-hidden'
            }
          >
            <button
              onClick={() =>
                setOpenMonths((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
              }
              className="w-full min-h-[3.5rem] flex items-center gap-3 px-4 sm:px-5 py-3 text-left active:bg-white/[0.04] transition-colors"
            >
              <CalendarDays
                className={`w-4 h-4 shrink-0 ${isMonthOpen ? 'text-primary' : 'text-content-muted'}`}
              />
              <span
                className={`font-bold text-[15px] capitalize ${isMonthOpen ? 'text-primary' : 'text-content'}`}
              >
                {group.label}
              </span>
              <span className="text-[12px] font-mono text-content-muted ml-auto shrink-0">
                {L.lessons(group.lessons.length)}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-content-muted shrink-0 transition-transform duration-200 ${
                  isMonthOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isMonthOpen && (
              <ul className="border-t border-white/[0.06] divide-y divide-white/[0.06]">
                {group.lessons.map((lesson) => {
                  const isOpen = openLessonId === lesson.id;
                  const topic = cleanVocabularyTopic(lesson.topic) || lesson.topic;
                  const date = new Date(lesson.date);
                  const dayLabel = isNaN(date.getTime())
                    ? lesson.date
                    : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });

                  return (
                    <li key={lesson.id}>
                      <button
                        onClick={() => setOpenLessonId(isOpen ? null : lesson.id)}
                        className="w-full min-h-[3.5rem] flex items-center gap-3 px-4 sm:px-5 py-3 text-left active:bg-white/[0.04] transition-colors"
                      >
                        <span className="font-mono text-[12px] text-content-muted shrink-0 w-14">
                          {dayLabel}
                        </span>
                        <span
                          className={`flex-1 min-w-0 text-[15px] leading-snug ${
                            isOpen ? 'text-primary font-bold' : 'text-content font-semibold'
                          } ${isOpen ? '' : 'truncate'}`}
                        >
                          {topic}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-content-muted shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-4 sm:px-5 pb-5 pt-1">
                          <LessonDetails
                            lesson={lesson}
                            studentId={studentId}
                            compact
                            onStudySet={onStudySet}
                            onPracticeAI={onPracticeAI}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default LessonHistoryMonths;
