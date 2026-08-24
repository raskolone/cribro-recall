import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  Loader2,
  Puzzle,
  RotateCcw,
  Sparkles,
  X as XIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { RecallItem, RetrievalResult } from '../../types';
import { getDueRecallItems, recordRetrievalAttempt } from '../../services/recallItems';
import PuzzleExercise from './PuzzleExercise';
import LastLessonCard from './LastLessonCard';

/**
 * „Dzisiaj" — domyślne wejście kursanta.
 *
 * Ekran nie generuje niczego. Sesja powtórek to wyłącznie elementy, które
 * lektor zatwierdził po konkretnych lekcjach i którym minął termin. Jeśli
 * kolejka jest pusta, sesji po prostu nie ma — to jest zamierzone. Wcześniej
 * panel kursanta dogenerowywał treść z całej historii lekcji, przez co kursant
 * dostawał materiał, którego lektor nigdy nie zatwierdził.
 *
 * Pusta kolejka nie może jednak znaczyć pustego ekranu. Elementy powstają
 * dopiero przy zapisie lekcji z krokiem zatwierdzania, więc zanim lektor zapisze
 * pierwszą taką lekcję, kolejka każdego kursanta jest pusta. Dlatego poza samą
 * sesją ekran zawsze pokazuje `LastLessonCard` — streszczenie, materiał
 * i następny krok z ostatniej lekcji. To druga pozycja panelu kursanta ze
 * specyfikacji („wiesz, co wynosisz ze spotkania"), a nie wypełniacz.
 *
 * Bez feedu, bez rankingu, bez licznika passy.
 */

interface TodayScreenProps {
  /** Wejście w „Praktykę dodatkową" — otwarty generator, nigdy jako domyślne. */
  onOpenExtraPractice?: () => void;
  onOpenLastLesson?: () => void;
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

const TodayScreen: React.FC<TodayScreenProps> = ({ onOpenExtraPractice, onOpenLastLesson }) => {
  const { user } = useAuth();
  const { language } = useLanguage();

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
    if (!user?.id) return;
    setPhase('loading');
    try {
      const due = await getDueRecallItems(user.id, SESSION_MAX);
      setItems(due);
      setPhase(due.length === 0 ? 'empty' : 'ready');
    } catch (error) {
      // Nieudany odczyt kolejki nie może zostawić kursanta na wieczystym
      // spinnerze — ostatnia lekcja jest do pokazania niezależnie od powtórek.
      console.error('Nie udało się wczytać kolejki powtórek:', error);
      setItems([]);
      setPhase('empty');
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const current = items[index];

  const L =
    language === 'pl'
      ? {
          loading: 'Wczytywanie…',
          emptyTitle: 'Na dziś nic nie czeka',
          emptyBody:
            'Powtórki pojawią się, gdy nadejdzie ich termin albo gdy lektor zatwierdzi elementy po następnej lekcji.',
          readyTitle: 'Dzisiaj',
          readyBody: (n: number, min: number) =>
            `${n} ${plItems(n)} z Twoich lekcji. Około ${min} min.`,
          start: 'Zacznij',
          doneTitle: 'Sesja skończona',
          doneBody: (n: number, confident: number) =>
            `${n} ${plItems(n)} za Tobą${confident > 0 ? `, w tym ${confident} pewnie` : ''}. Każdy wróci wtedy, kiedy trzeba.`,
          recheck: 'Sprawdź kolejkę',
          extraPractice: 'Praktyka dodatkowa',
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
        }
      : {
          loading: 'Loading…',
          emptyTitle: 'Nothing due today',
          emptyBody:
            'Reviews show up when they fall due, or when your teacher approves items after your next lesson.',
          readyTitle: 'Today',
          readyBody: (n: number, min: number) =>
            `${n} ${n === 1 ? 'item' : 'items'} from your lessons. About ${min} min.`,
          start: 'Start',
          doneTitle: 'Session complete',
          doneBody: (n: number, confident: number) =>
            `${n} ${n === 1 ? 'item' : 'items'} done${confident > 0 ? `, ${confident} of them confidently` : ''}. Each one comes back when it should.`,
          recheck: 'Check the queue',
          extraPractice: 'Extra practice',
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

    setResults((r) => [...r, result]);
    resetItemState();

    if (index + 1 >= items.length) setPhase('done');
    else setIndex((i) => i + 1);
  };

  const extraPracticeButton = onOpenExtraPractice && (
    <button
      onClick={onOpenExtraPractice}
      className="px-4 py-2 rounded-xl border border-white/15 text-content-muted font-semibold text-sm hover:border-primary/40 transition-colors"
    >
      {L.extraPractice}
    </button>
  );

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-content-muted gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> {L.loading}
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        <header className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{L.emptyTitle}</h1>
          <p className="text-content-muted mt-2 text-sm leading-relaxed">{L.emptyBody}</p>
        </header>

        {/* Kolejka pusta nie znaczy „nie ma nic do roboty" — z ostatniej lekcji
            zostaje streszczenie, materiał i następny krok. */}
        <LastLessonCard onOpenHistory={onOpenLastLesson} />

        {extraPracticeButton && (
          <div className="flex justify-center">{extraPracticeButton}</div>
        )}
      </div>
    );
  }

  if (phase === 'ready') {
    const minutes = Math.max(3, Math.round(items.length * 0.6));
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        <header className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{L.readyTitle}</h1>
          <p className="text-content-muted mt-2 text-sm">{L.readyBody(items.length, minutes)}</p>
          <button
            onClick={() => setPhase('session')}
            className="mt-7 px-6 py-3 rounded-xl bg-primary text-accent-ink font-bold"
          >
            {L.start}
          </button>
        </header>

        <LastLessonCard onOpenHistory={onOpenLastLesson} />
      </div>
    );
  }

  if (phase === 'done') {
    const confident = results.filter((r) => r === 'confident').length;
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        <header className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{L.doneTitle}</h1>
          <p className="text-content-muted mt-2 text-sm">
            {L.doneBody(results.length, confident)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <button
              onClick={() => {
                setIndex(0);
                setResults([]);
                resetItemState();
                load();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-content-muted font-semibold text-sm hover:border-primary/40 transition-colors"
            >
              <RotateCcw size={14} /> {L.recheck}
            </button>
            {extraPracticeButton}
          </div>
        </header>

        <LastLessonCard onOpenHistory={onOpenLastLesson} />
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(index / items.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-content-muted shrink-0">
          {index + 1}/{items.length}
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-base-200/50 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 font-mono">
            {current.learningType}
          </span>
        </div>

        {/* Kontekst: najpierw przypomnij sobie, potem sprawdź. */}
        <p className="text-xl sm:text-2xl font-bold text-white leading-snug">
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
            className="w-full mt-6 bg-base-200 border border-white/15 rounded-xl px-4 py-3 text-white text-lg focus:border-primary/60 focus:outline-none"
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
                className="px-3 py-1.5 rounded-lg border border-white/15 text-content text-sm font-semibold hover:border-warn/50 disabled:opacity-50"
              >
                {L.withEffort}
              </button>
              <button
                disabled={isSaving}
                onClick={() => finishItem('confident')}
                className="px-3 py-1.5 rounded-lg bg-primary text-accent-ink text-sm font-bold disabled:opacity-50"
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
              <p className="mt-2 font-mono text-sm text-white">{current.targetForm}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => {
                  setFeedback(null);
                  setAnswer('');
                }}
                className="px-3 py-1.5 rounded-lg border border-white/15 text-content text-sm font-semibold hover:border-primary/40"
              >
                {L.tryAgain}
              </button>
              {!revealed && (
                <button
                  onClick={() => setRevealed(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-content-muted text-sm font-semibold hover:border-white/30"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-warn/40 text-warn text-sm font-semibold hover:bg-warn/10"
                >
                  <Puzzle size={13} /> {L.showBlocks}
                </button>
              )}
              <button
                disabled={isSaving}
                onClick={() => finishItem('fail')}
                className="px-3 py-1.5 rounded-lg text-content-muted text-sm font-semibold hover:text-white disabled:opacity-50"
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
            className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-accent-ink font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {L.check} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TodayScreen;
