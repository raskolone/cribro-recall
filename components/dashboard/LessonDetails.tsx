import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, ChevronDown, KeyRound, ListChecks, Loader2, Sparkles, Tag, Target } from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
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
  const [showAnswerKey, setShowAnswerKey] = useState(false);

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
          block2Title: 'Słownictwo & Wymowa',
          correctionsTitle: 'Do poprawy & Wskazówki',
          homeworkTitle: 'Zadania z lekcji (Homework)',
          nextLessonTitle: 'Na kolejnej lekcji',
          answerKey: 'Klucz odpowiedzi',
          showAnswerKey: 'Pokaż klucz odpowiedzi ▼',
          hideAnswerKey: 'Ukryj klucz odpowiedzi ▲',
          more: 'Pokaż całość',
          less: 'Zwiń',
          empty: 'Lektor nie dodał jeszcze notatek do tej lekcji.',
          count: (n: number) => `${n}`,
          flashcards: 'Fiszki',
          aiSentences: 'Trening zdań',
        }
      : {
          block1Title: 'Lesson Overview',
          block2Title: 'Vocabulary & Pronunciation',
          correctionsTitle: 'To Work On & Notes',
          homeworkTitle: 'Homework Tasks',
          nextLessonTitle: 'Next Lesson',
          answerKey: 'Answer Key',
          showAnswerKey: 'Show answer key ▼',
          hideAnswerKey: 'Hide answer key ▲',
          more: 'Show all',
          less: 'Collapse',
          empty: 'Your teacher has not added notes to this lesson yet.',
          count: (n: number) => `${n}`,
          flashcards: 'Flashcards',
          aiSentences: 'Sentence practice',
        };

  const summary = firstSentences(blocks.summary, 3);
  const items = vocabulary.map(parseVocabLine).filter((item) => item.word.length > 0);
  const hasAnything =
    Boolean(blocks.summary) ||
    items.length > 0 ||
    Boolean(blocks.corrections) ||
    Boolean(blocks.homework);

  const headingClass =
    'text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-content-muted';

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {!hasAnything && !isLoading && <p className="text-sm text-content-muted">{L.empty}</p>}

      {/* BLOK 1: Lekcja w skrócie */}
      {blocks.summary && (
        <section className="space-y-2 p-3.5 rounded-2xl bg-sky-950/20 border border-sky-500/20">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
              BLOK 1
            </span>
            <h4 className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <BookOpen size={13} />
              {L.block1Title}
            </h4>
          </div>
          <div className="prose-justified text-[15px] sm:text-sm text-content leading-relaxed">
            <Markdown>{showFullSummary ? blocks.summary : summary.short}</Markdown>
          </div>
          {summary.truncated && (
            <button
              onClick={() => setShowFullSummary((v) => !v)}
              className="inline-flex items-center gap-1 min-h-[2.5rem] text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              {showFullSummary ? L.less : L.more}
              <ChevronDown
                size={13}
                className={`transition-transform ${showFullSummary ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </section>
      )}

      {/* BLOK 2a: Słownictwo */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className={`${headingClass} flex items-center gap-1.5 text-emerald-400`}>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              BLOK 2
            </span>
            <Tag size={12} className="text-emerald-400" />
            {L.block2Title}
            {items.length > 0 && (
              <span className="text-emerald-300/80">· {L.count(items.length)}</span>
            )}
          </h4>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-content-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>
        ) : (
          items.length > 0 && (
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
          )
        )}
      </section>

      {/* BLOK 2b: Korekty językowe i błędy */}
      {blocks.corrections && (
        <section className="rounded-2xl bg-amber-950/15 border border-amber-500/20 p-3.5 space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
            <AlertCircle size={13} />
            {L.correctionsTitle}
          </h4>
          <div className="prose-justified text-[14px] sm:text-xs text-content leading-relaxed">
            <Markdown>{blocks.corrections}</Markdown>
          </div>
        </section>
      )}

      {/* BLOK 3: Zadania domowe (Homework — Cribro Habit) */}
      {blocks.homework && (
        <section className="rounded-2xl bg-base-200/60 border border-amber-500/30 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                BLOK 3
              </span>
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <ListChecks size={14} />
                {L.homeworkTitle}
              </h4>
            </div>
          </div>
          <div className="text-xs text-content leading-relaxed whitespace-pre-wrap">
            <Markdown>{blocks.homework}</Markdown>
          </div>

          {/* Klucz odpowiedzi (Answer Key) */}
          {blocks.answerKey && (
            <div className="pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowAnswerKey((v) => !v)}
                className="text-[11px] font-bold text-content-muted hover:text-text-hi flex items-center gap-1 cursor-pointer transition-colors"
              >
                <KeyRound size={12} className="text-amber-400" />
                {showAnswerKey ? L.hideAnswerKey : L.showAnswerKey}
              </button>
              {showAnswerKey && (
                <div className="mt-2 p-2.5 rounded-xl bg-base-300/60 border border-white/5 text-xs text-content-muted leading-relaxed">
                  <Markdown>{blocks.answerKey}</Markdown>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* BLOK 4: Następna lekcja */}
      {blocks.nextLesson && (
        <section className="rounded-2xl bg-yellow-950/15 border border-yellow-500/20 p-3.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              BLOK 4
            </span>
            <h4 className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
              <Target size={13} />
              {L.nextLessonTitle}
            </h4>
          </div>
          <div className="text-xs text-content-muted leading-relaxed">
            <Markdown>{blocks.nextLesson}</Markdown>
          </div>
        </section>
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
