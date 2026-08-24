import React, { useEffect, useState } from 'react';
import { ArrowRight, BookMarked, CalendarDays, Loader2, Target } from 'lucide-react';
import Markdown from 'react-markdown';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LessonRecord } from '../../types';
import { getLessonRecordsForStudent } from '../../services/lessonRecord';
import { getApprovedItemsForLesson } from '../../services/studentContext';
import { splitVocabularyLines } from '../../utils/vocabulary';

/**
 * „Ostatnia lekcja" w panelu kursanta — „wiesz, co wynosisz ze spotkania".
 *
 * Ekran „Dzisiaj" pokazuje wyłącznie wymagalne powtórki, a te powstają dopiero
 * przy zapisie kolejnej lekcji z krokiem zatwierdzania. Dopóki lektor takiej
 * lekcji nie zapisze, kolejka każdego kursanta jest pusta — i bez tej karty
 * cały panel to jedno zdanie „nic na dziś". Materiał z odbytych lekcji leży
 * w bazie od dawna; brakowało miejsca, które podaje go kursantowi wprost.
 *
 * Karta niczego nie generuje i nie tworzy elementów do powtórek — czyta wpis
 * lekcji, który już istnieje. Trzy rzeczy ze specyfikacji, w tej kolejności:
 * streszczenie → zatwierdzone elementy → następny krok.
 */

interface LastLessonCardProps {
  /** Przejście do pełnej historii lekcji. */
  onOpenHistory?: () => void;
}

/**
 * Ile pozycji pokazujemy wprost.
 *
 * Zatwierdzonych elementów jest z założenia 3–10, więc limit dotyczy wyłącznie
 * lekcji sprzed wprowadzenia zatwierdzania, gdzie „słownictwo" bywa wklejem
 * na kilkadziesiąt linii. Reszta zostaje w historii lekcji.
 */
const MAX_VISIBLE_ITEMS = 12;

const LastLessonCard: React.FC<LastLessonCardProps> = ({ onOpenHistory }) => {
  const { user } = useAuth();
  const { language } = useLanguage();

  const [lesson, setLesson] = useState<LessonRecord | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Odpowiedzi z Firestore przychodzą asynchronicznie; bez tej flagi
    // przelogowanie w trakcie odczytu wstawiłoby do stanu lekcję poprzedniego
    // kursanta.
    let active = true;

    const load = async () => {
      if (!user?.id || user.id === 'demo-id') {
        setIsLoading(false);
        return;
      }
      try {
        const records = await getLessonRecordsForStudent(user.id);
        if (!active) return;

        const latest = records[0] || null;
        setLesson(latest);

        if (latest) {
          // Pozycje zatwierdzone po lekcji, a gdy zestaw ich nie ma (wpisy
          // sprzed wprowadzenia zatwierdzania) — całe słownictwo z lekcji.
          // Kursant widział ten materiał na zajęciach, więc pokazanie go nie
          // omija decyzji lektora; do powtórek i tak nic stąd nie trafia.
          const approved = await getApprovedItemsForLesson(user.id, latest.vocabularySetId);
          if (!active) return;
          setItems(approved ?? splitVocabularyLines(latest.vocabularyText));
        }
      } catch (error) {
        console.error('Nie udało się wczytać ostatniej lekcji:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const L =
    language === 'pl'
      ? {
          heading: 'Ostatnia lekcja',
          summary: 'Co przerabialiśmy',
          items: 'Elementy z lekcji',
          nextStep: 'Twój następny krok',
          more: (n: number) => `+ ${n} więcej w historii lekcji`,
          openHistory: 'Cała historia lekcji',
          noLessonTitle: 'Pierwsza lekcja jeszcze przed Tobą',
          noLessonBody:
            'Gdy lektor zapisze wpis po zajęciach, znajdziesz tu streszczenie, materiał i następny krok.',
          empty: 'Lektor nie dodał jeszcze notatek do tej lekcji.',
        }
      : {
          heading: 'Your last lesson',
          summary: 'What we covered',
          items: 'Items from the lesson',
          nextStep: 'Your next step',
          more: (n: number) => `+ ${n} more in lesson history`,
          openHistory: 'Full lesson history',
          noLessonTitle: 'Your first lesson is still ahead',
          noLessonBody:
            'Once your teacher saves a record after class, you will find the summary, the material and your next step here.',
          empty: 'Your teacher has not added notes to this lesson yet.',
        };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-content-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="rounded-2xl border border-white/10 bg-base-200/50 p-6 text-center">
        <h2 className="text-base font-bold text-content">{L.noLessonTitle}</h2>
        <p className="text-sm text-content-muted mt-2 leading-relaxed">{L.noLessonBody}</p>
      </div>
    );
  }

  const formattedDate = (() => {
    const parsed = new Date(lesson.date);
    if (isNaN(parsed.getTime())) return lesson.date;
    return parsed.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB', {
      day: 'numeric',
      month: 'long',
    });
  })();

  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = items.length - visibleItems.length;
  const hasContent = Boolean(lesson.lessonSummary) || items.length > 0 || Boolean(lesson.suggestedFollowUp);

  return (
    <section className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 sm:px-6 py-4 border-b border-white/10">
        <BookMarked className="w-4 h-4 text-primary shrink-0" />
        <h2 className="text-sm font-bold text-content uppercase tracking-wider">{L.heading}</h2>
        <span className="flex items-center gap-1.5 text-xs text-content-muted ml-auto">
          <CalendarDays size={12} />
          {formattedDate}
        </span>
      </header>

      <div className="px-5 sm:px-6 py-5 space-y-6">
        {lesson.topic && (
          <p className="text-lg font-bold text-white leading-snug">{lesson.topic}</p>
        )}

        {!hasContent && <p className="text-sm text-content-muted">{L.empty}</p>}

        {lesson.lessonSummary && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
              {L.summary}
            </h3>
            <div className="text-sm text-content leading-relaxed prose-sm max-w-none">
              <Markdown>{lesson.lessonSummary}</Markdown>
            </div>
          </div>
        )}

        {visibleItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
              {L.items}
            </h3>
            <ul className="space-y-1.5">
              {visibleItems.map((item, idx) => (
                <li
                  key={`${idx}-${item}`}
                  className="flex gap-2.5 text-sm text-content leading-relaxed"
                >
                  <span className="text-primary/60 shrink-0 select-none">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <p className="text-xs text-content-muted pt-1">{L.more(hiddenCount)}</p>
            )}
          </div>
        )}

        {lesson.suggestedFollowUp && (
          <div className="rounded-xl bg-warn/5 border border-warn/15 p-4 space-y-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-warn uppercase tracking-wider">
              <Target size={12} />
              {L.nextStep}
            </h3>
            <div className="text-sm text-content leading-relaxed prose-sm max-w-none">
              <Markdown>{lesson.suggestedFollowUp}</Markdown>
            </div>
          </div>
        )}

        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 text-sm font-semibold text-content-muted hover:text-primary transition-colors"
          >
            {L.openHistory}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </section>
  );
};

export default LastLessonCard;
