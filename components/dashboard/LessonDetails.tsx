import React, { useEffect, useState } from 'react';
import {
  AlertCircle, BookOpen, ChevronDown, ChevronUp, Loader2, Tag, Target, Activity,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { getApprovedItemsForLesson } from '../../services/studentContext';
import { splitVocabularyLines } from '../../utils/vocabulary';
import { firstSentences } from '../../utils/summary';
import { extractLessonBlocks } from '../../utils/lessonBlocks';
import TTSButtons from '../flashcards/TTSButtons';

interface LessonDetailsProps {
  lesson: LessonRecord;
  /** Czyje słownictwo czytamy — konto kursanta, także w podglądzie lektora. */
  studentId: string;
  /** Zwarty wariant do wnętrza rozwijanej historii. */
  compact?: boolean;
  /** Fiszki ze słownictwa tej lekcji. */
  onStudySet?: (setId: string) => void;
  /** Zdania AI na słownictwie tej lekcji. */
  onPracticeAI?: (setId: string) => void;
}

/** Rozbicie linii słownictwa na hasło i tłumaczenie. */
const parseVocabLine = (line: string): { word: string; translation: string | null } => {
  const clean = line.replace(/^[\s*\-•\d.]+\s*/, '').trim();
  const sep = clean.match(/\s+[-–—:=]\s+/);
  if (sep && sep.index !== undefined) {
    return {
      word: clean.slice(0, sep.index).trim(),
      translation: clean.slice(sep.index + sep[0].length).trim(),
    };
  }
  return { word: clean, translation: null };
};

const LessonDetails: React.FC<LessonDetailsProps> = ({
  lesson,
  studentId,
  compact = false,
  onStudySet,
  onPracticeAI,
}) => {
  const { language } = useLanguage();
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullSummary, setShowFullSummary] = useState(false);

  // Normalizujemy bloki lekcji (działa bezbłędnie dla starych i nowych wpisów)
  const blocks = extractLessonBlocks(lesson);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const load = async () => {
      if (!studentId || studentId === 'demo-id') {
        if (active) {
          setVocabulary(splitVocabularyLines(blocks.vocabulary || lesson.vocabularyText));
          setIsLoading(false);
        }
        return;
      }
      try {
        const approved = await getApprovedItemsForLesson(studentId, lesson.vocabularySetId);
        if (!active) return;
        setVocabulary(approved ?? splitVocabularyLines(blocks.vocabulary || lesson.vocabularyText));
      } catch (error) {
        console.error('Nie udało się wczytać słownictwa lekcji:', error);
        if (active) setVocabulary(splitVocabularyLines(blocks.vocabulary || lesson.vocabularyText));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [studentId, lesson.id, lesson.vocabularySetId, lesson.vocabularyText, blocks.vocabulary]);

  const L =
    language === 'pl'
      ? {
          block1Title: 'Lekcja w skrócie',
          block1Desc: 'Zwięzłe podsumowanie przebiegu lekcji',
          block2Title: 'Key Language & Corrections',
          block2Desc: 'Kluczowe słownictwo, wymowa i gramatyka',
          correctionsTitle: 'Things to Improve',
          correctionsDesc: 'Błędy do poprawy i wskazówki językowe',
          nextLessonTitle: 'Next Lesson',
          nextLessonDesc: 'Plany, tematyka i cele na kolejne spotkanie',
          learningCurveTitle: 'Learning Curve',
          learningCurveDesc: 'O czym mówił kursant, obserwacje dotyczące płynności i postępów',
          more: 'Pokaż całość',
          less: 'Zwiń',
          empty: 'Lektor nie dodał jeszcze notatek do tej lekcji.',
          count: (n: number) => `${n}`,
          flashcards: 'Fiszki',
          aiSentences: 'Trening zdań',
        }
      : {
          block1Title: 'Lesson Summary',
          block1Desc: 'Concise overview of what the lesson covered',
          block2Title: 'Key Language & Corrections',
          block2Desc: 'Key vocabulary, pronunciation and grammar',
          correctionsTitle: 'Things to Improve',
          correctionsDesc: 'Mistakes to work on and language notes',
          nextLessonTitle: 'Next Lesson',
          nextLessonDesc: 'Plans, topics and goals for the next meeting',
          learningCurveTitle: 'Learning Curve',
          learningCurveDesc: "What the student talked about, fluency and progress notes",
          more: 'Show all',
          less: 'Collapse',
          empty: 'Your teacher has not added notes to this lesson yet.',
          count: (n: number) => `${n}`,
          flashcards: 'Flashcards',
          aiSentences: 'Sentence practice',
        };

  const { user } = useAuth();
  const isTeacher = user?.role === 'admin' || user?.role === 'teacher';
  const summary = firstSentences(blocks.summary, 3);
  const items = vocabulary.map(parseVocabLine).filter((item) => item.word.length > 0);
  const hasAnything =
    Boolean(blocks.summary) || items.length > 0 || Boolean(blocks.corrections);

  // Sekcje domyślnie zwinięte — dokładnie ten sam wzorzec co w akordeonie
  // lektora (CascadingLessonDetails): kursant/lektor sam rozwija to, co go
  // interesuje, zamiast przewijać ścianę zawsze-rozwiniętego tekstu.
  const [expandedSections, setExpandedSections] = useState<{
    block1: boolean;
    block2: boolean;
    corrections: boolean;
    nextLesson: boolean;
    learningCurve: boolean;
  }>({
    block1: false,
    block2: false,
    corrections: false,
    nextLesson: false,
    learningCurve: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!hasAnything && !isLoading && <p className="text-sm text-content-muted">{L.empty}</p>}

      {/* BLOK 1: Lekcja w skrócie */}
      {blocks.summary && (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-950/15 overflow-hidden shadow-sm transition-all">
          <div
            onClick={() => toggleSection('block1')}
            className="p-3.5 bg-gradient-to-r from-sky-900/40 via-sky-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-sky-900/50 transition-colors select-none border-b border-sky-500/15"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                <BookOpen size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    BLOK 1
                  </span>
                  <h4 className="font-extrabold text-sm text-white">{L.block1Title}</h4>
                </div>
                <p className="text-[11px] text-sky-200/70">{L.block1Desc}</p>
              </div>
            </div>
            <div className="text-sky-300">
              {expandedSections.block1 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.block1 && (
            <div className="p-4 bg-sky-950/10 space-y-2">
              <div className="prose-justified text-[15px] sm:text-sm text-content leading-relaxed">
                <Markdown>{showFullSummary ? blocks.summary : summary.short}</Markdown>
              </div>
              {summary.truncated && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullSummary((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 min-h-[2.5rem] text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  {showFullSummary ? L.less : L.more}
                  <ChevronDown
                    size={13}
                    className={`transition-transform ${showFullSummary ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* BLOK 2: Key Language & Corrections */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 overflow-hidden shadow-sm transition-all">
        <div
          onClick={() => toggleSection('block2')}
          className="p-3.5 bg-gradient-to-r from-emerald-900/40 via-emerald-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-emerald-900/50 transition-colors select-none border-b border-emerald-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Tag size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  BLOK 2
                </span>
                <h4 className="font-extrabold text-sm text-white">{L.block2Title}</h4>
                {items.length > 0 && (
                  <span className="text-[11px] text-emerald-400/80 font-bold">
                    ({L.count(items.length)})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-200/70">{L.block2Desc}</p>
            </div>
          </div>
          <div className="text-emerald-300">
            {expandedSections.block2 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.block2 && (
          <div className="p-4 bg-emerald-950/10">
            {isLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-content-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
            ) : items.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {items.map((item, index) => (
                  <li
                    key={`${index}-${item.word}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-base-100/50 border border-white/[0.07] hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="block font-semibold text-white text-[15px] sm:text-sm leading-snug">
                        {item.word}
                      </span>
                      {item.translation && (
                        <span className="block text-xs text-content-muted leading-snug mt-0.5">
                          {item.translation}
                        </span>
                      )}
                    </div>
                    <TTSButtons text={item.word} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-content-muted italic">Brak słownictwa przypisanego do tej lekcji.</p>
            )}
          </div>
        )}
      </div>

      {/* Things to Improve (korekty i uwagi językowe) */}
      {blocks.corrections && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/15 overflow-hidden shadow-sm transition-all">
          <div
            onClick={() => toggleSection('corrections')}
            className="p-3.5 bg-gradient-to-r from-amber-900/40 via-amber-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-900/50 transition-colors select-none border-b border-amber-500/15"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertCircle size={16} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">{L.correctionsTitle}</h4>
                <p className="text-[11px] text-amber-200/70">{L.correctionsDesc}</p>
              </div>
            </div>
            <div className="text-amber-300">
              {expandedSections.corrections ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.corrections && (
            <div className="p-4 bg-amber-950/10">
              <div className="prose-justified text-[14px] sm:text-xs text-content leading-relaxed">
                <Markdown>{blocks.corrections}</Markdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BLOK 4: Next Lesson — wyłącznie dla lektora/admina (notatki operacyjne na kolejne zajęcia) */}
      {isTeacher && blocks.nextLesson && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-950/15 overflow-hidden shadow-sm transition-all">
          <div
            onClick={() => toggleSection('nextLesson')}
            className="p-3.5 bg-gradient-to-r from-yellow-900/40 via-yellow-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-yellow-900/50 transition-colors select-none border-b border-yellow-500/15"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <Target size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    BLOK 4
                  </span>
                  <h4 className="font-extrabold text-sm text-white">{L.nextLessonTitle}</h4>
                </div>
                <p className="text-[11px] text-yellow-200/70">{L.nextLessonDesc}</p>
              </div>
            </div>
            <div className="text-yellow-300">
              {expandedSections.nextLesson ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.nextLesson && (
            <div className="p-4 bg-yellow-950/10 text-xs text-content-muted leading-relaxed">
              <Markdown>{blocks.nextLesson}</Markdown>
            </div>
          )}
        </div>
      )}

      {/* Learning Curve — wyłącznie dla lektora/admina, ściśle ukryte przed kursantem */}
      {isTeacher && blocks.learningCurve && (
        <div className="rounded-2xl border border-purple-500/20 bg-purple-950/15 overflow-hidden shadow-sm transition-all">
          <div
            onClick={() => toggleSection('learningCurve')}
            className="p-3.5 bg-gradient-to-r from-purple-900/40 via-purple-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-purple-900/50 transition-colors select-none border-b border-purple-500/15"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Activity size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    LEARNING CURVE
                  </span>
                  <h4 className="font-extrabold text-sm text-white">{L.learningCurveTitle}</h4>
                </div>
                <p className="text-[11px] text-purple-200/70">{L.learningCurveDesc}</p>
              </div>
            </div>
            <div className="text-purple-300">
              {expandedSections.learningCurve ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.learningCurve && (
            <div className="p-4 bg-purple-950/10 text-xs text-content leading-relaxed">
              <Markdown>{blocks.learningCurve}</Markdown>
            </div>
          )}
        </div>
      )}

      {/* Ćwiczenie tego samego materiału — fiszki i zdania */}
      {items.length > 0 && (onStudySet || onPracticeAI) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {onStudySet && (
            <button
              onClick={() => onStudySet(`lesson_${lesson.id}`)}
              className="flex-1 min-w-[8rem] min-h-[2.75rem] flex items-center justify-center gap-1.5 px-4 rounded-xl bg-primary/12 border border-primary/30 text-primary font-bold text-[13px] active:scale-[0.99] transition-transform cursor-pointer"
            >
              🎴 {L.flashcards}
            </button>
          )}
          {onPracticeAI && (
            <button
              onClick={() => onPracticeAI(`lesson_${lesson.id}`)}
              className="flex-1 min-w-[8rem] min-h-[2.75rem] flex items-center justify-center gap-1.5 px-4 rounded-xl border border-white/15 text-content font-bold text-[13px] active:scale-[0.99] transition-transform cursor-pointer"
            >
              ✨ {L.aiSentences}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonDetails;
