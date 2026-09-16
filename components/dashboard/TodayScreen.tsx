import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Dumbbell,
  Eye,
  FileEdit,
  GraduationCap,
  History,
  Library,
  Puzzle,
  RotateCcw,
  Sparkles,
  X as XIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { RecallItem, RetrievalResult } from '../../types';
import { getDueRecallItems, logReviewSession, recordRetrievalAttempt } from '../../services/recallItems';
import { recordExerciseResults } from '../../services/learningProfile';
import { normalizeLevel } from '../../utils/learningCurve';
import PuzzleExercise from './PuzzleExercise';
import StudentLessonPanel from './StudentLessonPanel';
import StudentHomeworkPanelSection from './StudentHomeworkPanelSection';
import StudentTestsPanelSection from './StudentTestsPanelSection';
import PracticeSessionsSection from './PracticeSessionsSection';
import StudentHeroHeader from './StudentHeroHeader';
import StudentToolBar, { StudentTool } from './StudentToolBar';
import GSAPModuleTransition from '../ui/GSAPModuleTransition';

/**
 * Panel kursanta — domyślne wejście po zalogowaniu.
 *
 * Kolejność jest treścią tego ekranu, nie kwestią gustu: powtórki na dziś,
 * ćwiczenia od lektora, ostatnia lekcja, a pod kreską to, do czego się wraca —
 * starsze lekcje i własne sesje ćwiczeń. Kursant otwiera aplikację między
 * zajęciami i ma zobaczyć, co ma zrobić i co było ostatnio, bez zakładek.
 *
 * Poza paskiem powtórek wszystko jest zwinięte. Panel pokazuje spis tego, co
 * można otworzyć — treść wchodzi dopiero po dotknięciu.
 *
 * ══ LISTWA KAFELKÓW ZAMIAST STOSU SEKCJI ══
 *
 * Zadania, testy, wcześniejsze lekcje i historia ćwiczeń siedzą za kafelkami
 * (`StudentToolBar`), a ich treść otwiera się jednym panelem pod listwą.
 * Wcześniej były stosem zwijanych pasków: na telefonie dojście do testów
 * znaczyło przewinięcie wszystkiego powyżej, a spis możliwości nigdy nie
 * mieścił się na jednym ekranie. Teraz mieści się cały, nad zgięciem.
 *
 * Nad listwą zostają dwie rzeczy, po które kursant wchodzi codziennie:
 * nagłówek ze stanem zadań i karta powtórek na dziś. Pod listwą — ostatnia
 * lekcja, bo do niej też wraca się bez szukania.
 *
 * Ekran jest projektowany pod telefon: jedna kolumna, cele dotyku od 44 px,
 * treść zaczyna się nad zgięciem. Wersja na dużym ekranie to ta sama kolumna,
 * tylko wyśrodkowana.
 *
 * Sesja powtórek to wyłącznie elementy zatwierdzone przez lektora po konkretnej
 * lekcji, którym minął termin. Pusta kolejka nie generuje niczego zastępczego —
 * po prostu nie ma karty powtórek, a panel zaczyna się od zadań i lekcji.
 */

interface TodayScreenProps {
  /** Wejście w „Praktykę dodatkową" — otwarty generator, nigdy jako domyślne. */
  onOpenExtraPractice?: () => void;
  /** Wejście w zadanie od lektora. */
  onOpenHomework?: (taskId?: string) => void;
  /** Wejście w testy kursanta. */
  onOpenTests?: (testId?: string) => void;
  /** Wejście we wspólny brudnopis z lektorem. */
  onOpenScratchpad?: () => void;
  /** Wejście we własne zestawy słownictwa i fiszki. */
  onOpenVocabulary?: () => void;
  /** Podgląd panelu konkretnego kursanta (lektor). Bez zapisu powtórek. */
  studentId?: string;
  onStudySet?: (setId: string) => void;
  onPracticeAI?: (setId: string) => void;
}

/** Ile elementów wchodzi do jednej sesji. */
const SESSION_MAX = 10;

/** Po tylu nieudanych próbach na TYM SAMYM elemencie proponujemy układankę. */
const PUZZLE_AFTER_FAILS = 2;

/**
 * Porównanie odpowiedzi z formą docelową.
 *
 * Kursant pisze z pamięci, więc interpunkcja i wielkość liter nie mogą
 * decydować o wyniku — inaczej „dont" kontra „don't" liczyłoby się jako błąd
 * przypomnienia sobie, którym nie jest.
 */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[.,!?;:"„”]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Polska odmiana „element" przez liczbę — 1 element, 2 elementy, 5 elementów. */
const plItems = (n: number): string => {
  if (n === 1) return 'element';
  const rest10 = n % 10;
  const rest100 = n % 100;
  if (rest10 >= 2 && rest10 <= 4 && (rest100 < 10 || rest100 >= 20)) return 'elementy';
  return 'elementów';
};

type Phase = 'loading' | 'ready' | 'empty' | 'session' | 'done';
type Feedback = null | 'correct' | 'wrong';

const TodayScreen: React.FC<TodayScreenProps> = ({
  onOpenExtraPractice,
  onOpenHomework,
  onOpenTests,
  onOpenScratchpad,
  onOpenVocabulary,
  studentId,
  onStudySet,
  onPracticeAI,
}) => {
  const { user, updateUserStreak } = useAuth();
  const { language } = useLanguage();

  // Lektor oglądający panel kursanta czyta cudze dane. Powtórki są wtedy
  // wyłączone: zapis próby trafiłby do historii kursanta i przestawił mu
  // terminy elementów, których nawet nie widział.
  const targetId = studentId || user?.id || '';
  const isPreview = Boolean(studentId && studentId !== user?.id);

  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<RecallItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [failCount, setFailCount] = useState(0);
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<RetrievalResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || isPreview) {
      setPhase('empty');
      return;
    }
    setPhase('loading');
    try {
      const due = await getDueRecallItems(user.id, SESSION_MAX);
      setItems(due);
      setPhase(due.length === 0 ? 'empty' : 'ready');
    } catch (error) {
      // Nieudany odczyt kolejki nie może zabrać kursantowi reszty panelu —
      // lekcje i zadania są do pokazania niezależnie od powtórek.
      console.error('Nie udało się wczytać kolejki powtórek:', error);
      setItems([]);
      setPhase('empty');
    }
  }, [user?.id, isPreview]);

  useEffect(() => {
    load();
  }, [load]);

  const current = items[index];

  /**
   * Który kafelek listwy jest otwarty.
   *
   * Jeden naraz i domyślnie żaden: panel ma się otwierać na spisie
   * możliwości, nie na treści, której kursant w tej chwili nie szukał.
   */
  const [openTool, setOpenTool] = useState<string | null>(null);

  const L =
    language === 'pl'
      ? {
          reviewTitle: 'Powtórki na dziś',
          reviewBody: (n: number, min: number) => `${n} ${plItems(n)} · około ${min} min`,
          start: 'Zacznij',
          doneTitle: 'Sesja skończona',
          doneBody: (n: number, confident: number) =>
            `${n} ${plItems(n)} za Tobą${confident > 0 ? `, w tym ${confident} pewnie` : ''}.`,
          recheck: 'Sprawdź kolejkę',
          recallPrompt: 'Przypomnij sobie formę z lekcji',
          puzzleHint: 'Podpowiedź — ułóż formę z klocków, potem wpisz ją z pamięci.',
          inputPlaceholder: 'Wpisz z pamięci po angielsku…',
          correct: 'Dobrze',
          howWasIt: 'Jak Ci poszło?',
          withEffort: 'Z trudem',
          confidently: 'Pewnie',
          wrong: 'Jeszcze nie to',
          tryAgain: 'Spróbuj jeszcze raz',
          showForm: 'Pokaż formę',
          showBlocks: 'Pokaż klocki',
          giveUp: 'Nie pamiętam — dalej',
          check: 'Sprawdź',
          tools: {
            homework: 'Moje zadania',
            tests: 'Moje testy',
            lessons: 'Wcześniejsze lekcje',
            practice: 'Historia ćwiczeń',
            vocabulary: 'Moje słownictwo',
            extraPractice: 'Praktyka dodatkowa',
            scratchpad: 'Mój notatnik',
          },
        }
      : {
          reviewTitle: 'Reviews due today',
          reviewBody: (n: number, min: number) =>
            `${n} ${n === 1 ? 'item' : 'items'} · about ${min} min`,
          start: 'Start',
          doneTitle: 'Session complete',
          doneBody: (n: number, confident: number) =>
            `${n} ${n === 1 ? 'item' : 'items'} done${confident > 0 ? `, ${confident} of them confidently` : ''}.`,
          recheck: 'Check the queue',
          recallPrompt: 'Recall the form from your lesson',
          puzzleHint: 'A hint — build the form from the blocks, then type it from memory.',
          inputPlaceholder: 'Type it from memory in English…',
          correct: 'Correct',
          howWasIt: 'How did that go?',
          withEffort: 'With effort',
          confidently: 'Confidently',
          wrong: 'Not quite',
          tryAgain: 'Try again',
          showForm: 'Show the form',
          showBlocks: 'Show the blocks',
          giveUp: "I don't remember — move on",
          check: 'Check',
          tools: {
            homework: 'My tasks',
            tests: 'My tests',
            lessons: 'Earlier lessons',
            practice: 'Practice history',
            vocabulary: 'My word lists',
            extraPractice: 'Extra practice',
            scratchpad: 'My notebook',
          },
        };

  const resetItemState = () => {
    setAnswer('');
    setFeedback(null);
    setFailCount(0);
    setShowPuzzle(false);
    setRevealed(false);
  };

  const handleCheck = () => {
    if (!current || !answer.trim()) return;
    const ok = normalize(answer) === normalize(current.targetForm);
    setFeedback(ok ? 'correct' : 'wrong');
    if (!ok) setFailCount((c) => c + 1);
  };

  /** Zapisuje wynik próby i przechodzi dalej. */
  const finishItem = async (result: RetrievalResult) => {
    if (!current || !user?.id) return;
    setIsSaving(true);
    try {
      await recordRetrievalAttempt(user.id, current.id, result);
    } catch (e) {
      // Nieudany zapis nie może zablokować sesji — kursant ma dokończyć
      // powtórkę, a element po prostu wróci w kolejce następnym razem.
      console.error('Nie udało się zapisać wyniku próby:', e);
    } finally {
      setIsSaving(false);
    }

    const nextResults = [...results, result];
    setResults(nextResults);
    resetItemState();

    const isSessionDone = index + 1 >= items.length;
    if (isSessionDone) {
      // Bez tego powtórki są jedynym ćwiczeniem, które nie trafia do historii
      // sesji ani nie liczy się do passy — każdy inny tryb robi to od razu.
      logReviewSession(user.id, items, nextResults).catch((e) =>
        console.error('Nie udało się zapisać sesji powtórek w historii:', e)
      );
      // Powtórka to najczystszy sygnał retencji, jaki mamy — „z trudem" liczy
      // się jako trafienie, bo kursant jednak przypomniał sobie formę.
      recordExerciseResults(
        user.id,
        items.slice(0, nextResults.length).map((item, i) => ({
          prompt: item.meaningOrFunction,
          expected: item.targetForm,
          given: '',
          isCorrect: nextResults[i] !== 'fail',
          score: nextResults[i] === 'confident' ? 100 : nextResults[i] === 'effort' ? 60 : 0,
          level: normalizeLevel(user.level),
          exerciseType: 'recall',
          date: new Date().toISOString(),
        })),
        user.level
      ).catch(console.error);
      if (updateUserStreak) updateUserStreak().catch(console.error);
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
    }
  };

  // ————— Sesja powtórek: osobny, pełnoekranowy tryb —————
  if (phase === 'session' && current) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-1.5 rounded-full bg-line-soft overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(index / items.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-content-muted shrink-0">
            {index + 1}/{items.length}
          </span>
        </div>

        <div className="rounded-2xl border border-line-strong bg-base-200/50 p-5 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 font-mono">
              {current.learningType}
            </span>
          </div>

          {/* Kontekst: najpierw przypomnij sobie, potem sprawdź. */}
          <p className="text-xl sm:text-2xl font-bold text-text-hi leading-snug">
            {current.meaningOrFunction || L.recallPrompt}
          </p>
          {current.teacherNote && (
            <p className="text-sm text-content-muted mt-2">{current.teacherNote}</p>
          )}

          {showPuzzle ? (
            <div className="mt-6">
              <p className="text-xs text-content-muted mb-3 flex items-center gap-1.5">
                <Puzzle size={13} className="text-warn" />
                {L.puzzleHint}
              </p>
              <PuzzleExercise
                sentence={current.targetForm}
                level="A2"
                currentAnswer={answer}
                onAnswerChange={setAnswer}
              />
            </div>
          ) : (
            <input
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                if (feedback) setFeedback(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !feedback) handleCheck();
              }}
              autoFocus
              placeholder={L.inputPlaceholder}
              className="w-full mt-6 bg-base-200 border border-line-strong rounded-xl px-4 py-3.5 text-text-hi text-base focus:border-primary/60 focus:outline-none"
            />
          )}

          {feedback === 'correct' && (
            <div className="mt-5 p-4 rounded-xl bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Check size={16} /> {L.correct}
              </div>
              <p className="text-xs text-content-muted mt-2">{L.howWasIt}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  disabled={isSaving}
                  onClick={() => finishItem('effort')}
                  className="min-h-[2.75rem] px-4 rounded-lg border border-line-strong text-content text-sm font-semibold hover:border-warn/50 disabled:opacity-50"
                >
                  {L.withEffort}
                </button>
                <button
                  disabled={isSaving}
                  onClick={() => finishItem('confident')}
                  className="min-h-[2.75rem] px-4 rounded-lg bg-primary text-accent-ink text-sm font-bold disabled:opacity-50"
                >
                  {L.confidently}
                </button>
              </div>
            </div>
          )}

          {feedback === 'wrong' && (
            <div className="mt-5 p-4 rounded-xl bg-danger/10 border border-danger/30">
              <div className="flex items-center gap-2 text-danger font-bold text-sm">
                <XIcon size={16} /> {L.wrong}
              </div>
              {revealed && (
                <p className="mt-2 font-mono text-sm text-text-hi">{current.targetForm}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => {
                    setFeedback(null);
                    setAnswer('');
                  }}
                  className="min-h-[2.75rem] px-4 rounded-lg border border-line-strong text-content text-sm font-semibold hover:border-primary/40"
                >
                  {L.tryAgain}
                </button>
                {!revealed && (
                  <button
                    onClick={() => setRevealed(true)}
                    className="flex items-center gap-1.5 min-h-[2.75rem] px-4 rounded-lg border border-line-strong text-content-muted text-sm font-semibold hover:border-primary/40"
                  >
                    <Eye size={13} /> {L.showForm}
                  </button>
                )}
                {/* Układanka wyłącznie po dwóch nieudanych próbach na tym samym
                    elemencie — nigdy jako równoległa opcja na starcie. */}
                {failCount >= PUZZLE_AFTER_FAILS && !showPuzzle && (
                  <button
                    onClick={() => {
                      setShowPuzzle(true);
                      setFeedback(null);
                      setAnswer('');
                    }}
                    className="flex items-center gap-1.5 min-h-[2.75rem] px-4 rounded-lg border border-warn/40 text-warn text-sm font-semibold hover:bg-warn/10"
                  >
                    <Puzzle size={13} /> {L.showBlocks}
                  </button>
                )}
                <button
                  disabled={isSaving}
                  onClick={() => finishItem('fail')}
                  className="min-h-[2.75rem] px-3 rounded-lg text-content-muted text-sm font-semibold hover:text-text-hi disabled:opacity-50"
                >
                  {L.giveUp}
                </button>
              </div>
            </div>
          )}

          {!feedback && (
            <button
              onClick={handleCheck}
              disabled={!answer.trim()}
              className="mt-6 w-full flex items-center justify-center gap-2 min-h-[3.25rem] px-5 rounded-xl bg-primary text-accent-ink font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {L.check} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ————— Panel: nagłówek → powtórki → listwa → treść → ostatnia lekcja —————
  const reviewCard = (() => {
    if (phase === 'ready' && items.length > 0) {
      const minutes = Math.max(3, Math.round(items.length * 0.6));
      return (
        <section className="liquid-glass-card border-primary/30 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-text-hi leading-snug">{L.reviewTitle}</h2>
              <p className="text-[13px] text-content-muted mt-0.5">
                {L.reviewBody(items.length, minutes)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPhase('session')}
            className="mt-3 w-full min-h-[3rem] flex items-center justify-center gap-2 rounded-xl bg-primary text-accent-ink font-bold text-sm active:scale-[0.99] transition-transform"
          >
            {L.start}
            <ArrowRight size={16} />
          </button>
        </section>
      );
    }

    if (phase === 'done') {
      const confident = results.filter((r) => r === 'confident').length;
      return (
        <section className="liquid-glass-card border-primary/25 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Check className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-text-hi leading-snug">{L.doneTitle}</h2>
              <p className="text-[13px] text-content-muted mt-0.5">
                {L.doneBody(results.length, confident)}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIndex(0);
              setResults([]);
              resetItemState();
              load();
            }}
            className="mt-3 w-full min-h-[3rem] flex items-center justify-center gap-2 rounded-xl border border-line-strong text-content font-bold text-sm active:scale-[0.99] transition-transform"
          >
            <RotateCcw size={14} /> {L.recheck}
          </button>
        </section>
      );
    }

    // Pusta kolejka nie dostaje własnej karty — panel zaczyna się wtedy od
    // zadań lektora i ostatniej lekcji, czyli od treści, nie od komunikatu.
    return null;
  })();

  /*
   * Kafelki listwy.
   *
   * Notatnik prowadzi gdzie indziej (pełny ekran do pisania), więc ma
   * `onNavigate` zamiast panelu — i tylko na dużym ekranie, bo wspólne
   * pisanie na telefonie nie działa. Reszta otwiera się pod listwą.
   *
   * Kafelki nie noszą liczników: policzenie zadań i testów tutaj znaczyłoby
   * drugi odczyt tych samych kolekcji, które sekcje i tak czytają po
   * otwarciu, a stan „coś czeka" mówi już nagłówek wyżej.
   */
  const tools: StudentTool[] = [
    {
      id: 'homework',
      domId: 'tour-homework',
      label: L.tools.homework,
      icon: <BookOpen size={20} />,
      /* Kropka z flag, które już są w profilu kursanta — te same, którymi
         świeci menu boczne. Policzenie zadań tutaj znaczyłoby drugi nasłuch
         na tej samej kolekcji. Podgląd lektora nie świeci: to nie jego
         nieprzeczytane rzeczy. */
      highlight: !studentId && (Boolean(user?.hasNewHomework) || Boolean(user?.hasGradedHomework)),
    },
    {
      id: 'tests',
      domId: 'tour-tests',
      label: L.tools.tests,
      icon: <GraduationCap size={20} />,
    },
    {
      id: 'lessons',
      domId: 'tour-history',
      label: L.tools.lessons,
      icon: <History size={20} />,
      highlight: !studentId && Boolean(user?.hasNewLesson),
    },
    {
      id: 'practice',
      domId: 'tour-practice',
      label: L.tools.practice,
      icon: <Dumbbell size={20} />,
    },
    /*
     * Słownictwo i praktyka dodatkowa dochodzą tu po zdjęciu menu bocznego.
     * Oba były dotąd wyłącznie tam, więc bez kafelków nie byłoby do nich
     * żadnej drogi — a to ekrany, po które kursant wraca sam z siebie,
     * nie dlatego, że lektor coś zadał.
     */
    ...(onOpenVocabulary
      ? [
          {
            id: 'vocabulary',
            domId: 'tour-flashcards',
            label: L.tools.vocabulary,
            icon: <Library size={20} />,
            onNavigate: onOpenVocabulary,
          } satisfies StudentTool,
        ]
      : []),
    /*
     * „Praktyka dodatkowa" NIE MA tu kafelka.
     *
     * Dokładnie to samo wejście stoi w nagłówku jako jedyny duży, zielony
     * przycisk — i stoi tam po coś: to jest rzecz, którą kursant ma zrobić,
     * gdy lektor nic nie zadał. Kafelek obok powtarzał je drobniejszą
     * czcionką, przez co siatka miała siedem pozycji zamiast sześciu i nie
     * dawała się ułożyć równo w żadnej szerokości.
     */
    ...(onOpenScratchpad
      ? [
          {
            id: 'scratchpad',
            domId: 'tour-scratchpad',
            label: L.tools.scratchpad,
            icon: <FileEdit size={20} />,
            onNavigate: onOpenScratchpad,
          } satisfies StudentTool,
        ]
      : []),
  ];

  /*
   * Zapas u dołu na telefonie (`pb-24`): przycisk zgłaszania błędu wisi
   * na stałe w prawym dolnym rogu i bez tego zasłaniał ostatni kafelek
   * listwy. Na dużym ekranie wraca zwykły odstęp.
   */
  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 pt-5 pb-24 sm:py-8 space-y-6">
      {/* Szerszy nagłówek główny ze statystykami, gratulacjami i statusem zadań od lektora */}
      <div data-coach="tour-hero">
      <StudentHeroHeader
        studentId={targetId}
        onOpenHomework={onOpenHomework || (() => {})}
        onOpenExtraPractice={onOpenExtraPractice || (() => {})}
        onOpenTests={onOpenTests || (() => {})}
        streakCount={user?.streakCount || 0}
        streakHidden={user?.streakHidden}
      />
      </div>

      {/* Ta sama szerokość, co nagłówek wyżej. Wcześniej nagłówek miał 768 px,
          a listwa kafelków pod nim 672 px — krawędzie nie schodziły się w pionie
          i panel wyglądał na złożony z dwóch różnych ekranów. */}
      <div className="space-y-5">
        {reviewCard}

        <StudentToolBar
          tools={tools}
          openId={openTool}
          onToggle={(id) => setOpenTool((prev) => (prev === id ? null : id))}
        />

        {/* Treść otwartego kafelka — zawsze w tym samym miejscu, pod listwą.

            Z własnym paskiem tytułu: sekcje renderują się bez nagłówków
            (`headless`), więc po otwarciu kursant dostawał ramkę z treścią
            i NICZYM, co by mówiło, na co patrzy — a po przewinięciu kafelek
            z podpisem był już poza ekranem. Pasek mówi to raz i daje wyjście
            w tym samym miejscu, w którym kończy się czytanie. */}
        <GSAPModuleTransition activeKey={openTool || 'none'}>
          {openTool && (
            <div className="rounded-2xl border border-line-strong bg-base-200/40 overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-line-soft bg-base-300/40">
                <span className="min-w-0 flex items-center gap-2 text-sm font-bold text-text-hi truncate">
                  {tools.find((tool) => tool.id === openTool)?.icon}
                  {tools.find((tool) => tool.id === openTool)?.label}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenTool(null)}
                  className="shrink-0 h-8 px-2.5 rounded-lg border border-line-strong bg-white/[0.04] text-text-2 hover:text-content hover:bg-white/[0.08] text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {language === 'pl' ? 'Zwiń' : 'Collapse'}
                </button>
              </div>
              {openTool === 'homework' && (
                <StudentHomeworkPanelSection
                  headless
                  studentId={targetId}
                  onOpenHomework={onOpenHomework || (() => {})}
                />
              )}
              {openTool === 'tests' && (
                <StudentTestsPanelSection
                  headless
                  studentId={targetId}
                  onOpenTests={onOpenTests || (() => {})}
                />
              )}
              {openTool === 'lessons' && (
                <StudentLessonPanel
                  headless
                  only="earlier"
                  studentId={targetId}
                  onStudySet={onStudySet}
                  onPracticeAI={onPracticeAI}
                />
              )}
              {openTool === 'practice' && <PracticeSessionsSection headless studentId={targetId} />}
            </div>
          )}
        </GSAPModuleTransition>

        {/* Ostatnia lekcja zostaje poza listwą: to jedyna rzecz z historii, do
            której kursant wraca codziennie, i ma być widoczna bez dotknięcia. */}
        <StudentLessonPanel
          only="latest"
          studentId={targetId}
          onStudySet={onStudySet}
          onPracticeAI={onPracticeAI}
        />
      </div>
    </div>
  );
};

export default TodayScreen;
