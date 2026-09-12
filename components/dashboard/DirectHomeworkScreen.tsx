import React, { useEffect, useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Send, 
  BookOpen, 
  Award, 
  LogIn, 
  Loader2, 
  Check, 
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { HomeworkType } from '../../types';
import HomeworkExercise from './HomeworkExercise';
import ConstellationBackground from '../ui/ConstellationBackground';

interface DirectTaskSentence {
  id: string;
  type: HomeworkType;
  polishSentence?: string;
  polishHint?: string;
  chunks?: string[];
  question?: string;
  options?: string[];
  textWithBlanks?: string;
  blanks?: any;
  availableWords?: string[];
  incorrectSentence?: string;
  hint?: string;
  explanation?: string;
}

interface DirectTaskData {
  id: string;
  title: string;
  type: HomeworkType;
  types?: HomeworkType[];
  instructions?: string;
  dueDate?: string;
  status: string;
  studentName: string;
  studentId: string;
  sentences: DirectTaskSentence[];
  studentAnswers?: Record<string, any>;
  evaluationResults?: any[];
  submittedAt?: string | null;
  accessExpiresAt?: string | null;
  isAlreadySubmitted: boolean;
}

type ScreenPhase = 'loading' | 'error' | 'already_submitted' | 'solving' | 'submitting' | 'submitted';

export const DirectHomeworkScreen: React.FC = () => {
  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorType, setErrorType] = useState<'expired' | 'not_found' | 'server_error' | null>(null);
  const [task, setTask] = useState<DirectTaskData | null>(null);
  const [token, setToken] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [evalResults, setEvalResults] = useState<any[]>([]);

  // Wyciągnij token z query (?token=...) lub ze ścieżki (/hw/:token lub /homework-direct/:token)
  useEffect(() => {
    let extractedToken = '';
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      extractedToken = searchParams.get('token') || '';

      if (!extractedToken) {
        const path = window.location.pathname;
        const match = path.match(/^\/(?:hw|homework-direct)\/([^/?#]+)/);
        if (match && match[1]) {
          extractedToken = decodeURIComponent(match[1]);
        }
      }
    }

    if (!extractedToken) {
      setErrorType('not_found');
      setErrorMessage('Nie podano tokenu dostępu do pracy domowej.');
      setPhase('error');
      return;
    }

    setToken(extractedToken);
    loadTask(extractedToken);
  }, []);

  const loadTask = async (authToken: string) => {
    setPhase('loading');
    setErrorMessage('');
    try {
      const res = await fetch(`/api/homework/direct/${encodeURIComponent(authToken)}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorType(data.error === 'expired' ? 'expired' : 'not_found');
        setErrorMessage(data.message || 'Nie udało się wczytać zadania.');
        setPhase('error');
        return;
      }

      const taskData: DirectTaskData = data.task;
      setTask(taskData);

      if (taskData.isAlreadySubmitted) {
        setFinalScore(null);
        setEvalResults(taskData.evaluationResults || []);
        setPhase('already_submitted');
      } else {
        setPhase('solving');
      }
    } catch (err: any) {
      console.error('[DirectHomeworkScreen] Błąd pobierania zadania:', err);
      setErrorType('server_error');
      setErrorMessage('Wystąpił problem z połączeniem sieciowym. Sprawdź internet i spróbuj ponownie.');
      setPhase('error');
    }
  };

  const handleAnswerChange = (val: any) => {
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: val,
    }));
  };

  const answeredCount = useMemo(() => {
    return Object.keys(answers).filter((k) => {
      const val = answers[Number(k)];
      if (val === undefined || val === null) return false;
      if (typeof val === 'string') return val.trim().length > 0;
      if (typeof val === 'object') return Object.keys(val).length > 0;
      return true;
    }).length;
  }, [answers]);

  const handleSubmit = async () => {
    if (!task || !token) return;

    const total = task.sentences.length;
    if (answeredCount < total) {
      const confirmSubmit = window.confirm(
        `Wypełniłeś ${answeredCount} z ${total} ćwiczeń. Czy na pewno chcesz przesłać pracę w obecnym stanie?`
      );
      if (!confirmSubmit) return;
    }

    setPhase('submitting');
    try {
      const res = await fetch('/api/homework/direct-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          answers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'already_submitted') {
          alert('Ta praca domowa została już wcześniej oddana.');
          await loadTask(token);
          return;
        }
        throw new Error(data.message || 'Nie udało się zapisać pracy domowej.');
      }

      setFinalScore(typeof data.score === 'number' ? data.score : 100);
      setEvalResults(data.evaluationResults || []);
      setPhase('submitted');
    } catch (err: any) {
      console.error('[DirectHomeworkScreen] Błąd wysyłania:', err);
      alert('Błąd podczas wysyłania: ' + (err.message || 'Spróbuj ponownie za chwilę.'));
      setPhase('solving');
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen relative text-content bg-base-100 flex flex-col items-center justify-start selection:bg-primary/30">
      <ConstellationBackground />
      <div className="relative z-10 w-full max-w-3xl px-4 py-8 sm:py-12 flex flex-col items-center">
        {/* Subtelny branding CRIBRO ENGLISH */}
        <div className="w-full flex items-center justify-between pb-6 mb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black text-sm tracking-wider shadow-inner">
              CR
            </div>
            <div>
              <span className="font-bold tracking-wider text-sm text-white uppercase block">
                CRIBRO ENGLISH
              </span>
              <span className="text-[11px] text-content-muted">
                Zadanie domowe kursanta
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-content-muted hover:text-text-hi hover:border-white/20 transition-colors"
          >
            <LogIn size={13} />
            <span>Logowanie do panelu</span>
          </button>
        </div>

        {children}
      </div>
    </div>
  );

  // 1. ŁADOWANIE
  if (phase === 'loading') {
    return shell(
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-content-muted animate-pulse">
          Wczytywanie Twojego zadania domowego…
        </p>
      </div>
    );
  }

  // 2. BŁĄD / WYGAŚNIĘCIE LINKU
  if (phase === 'error') {
    return shell(
      <div className="w-full bg-base-200/80 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 text-center shadow-xl">
        <div className="w-14 h-14 mx-auto rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
          <Clock size={28} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            {errorType === 'expired' ? 'Link do zadania wygasł' : 'Nie znaleziono materiału'}
          </h2>
          <p className="text-[15px] text-content-muted max-w-lg mx-auto leading-relaxed">
            {errorMessage ||
              'Ten unikalny link do zadania nie jest już dostępny lub stracił ważność. Skontaktuj się ze swoim lektorem, aby wygenerować świeży dostęp.'}
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="w-full sm:w-auto px-6 min-h-[3rem] rounded-xl bg-primary text-accent-ink font-bold text-sm shadow-md hover:opacity-90 transition-opacity"
          >
            Przejdź do logowania
          </button>
        </div>
      </div>
    );
  }

  // 3. PRACA ZOSTAŁA JUŻ ODDANA
  if (phase === 'already_submitted' && task) {
    return shell(
      <div className="w-full space-y-6">
        <div className="bg-base-200/80 border border-emerald-500/20 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileCheck size={24} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                Zadanie ukończone
              </span>
              <h2 className="text-xl font-bold text-white">
                {task.title || 'Praca domowa'}
              </h2>
            </div>
          </div>

          <p className="text-[15px] text-content-muted leading-relaxed">
            Cześć, <strong className="text-white">{task.studentName}</strong>! Ta praca domowa została już wcześniej oddana i zapisana w Twoim profilu kursanta.
          </p>

          {task.submittedAt && (
            <div className="text-xs text-content-muted font-mono flex items-center gap-2">
              <Clock size={13} />
              <span>Data przesłania: {new Date(task.submittedAt).toLocaleString('pl-PL')}</span>
            </div>
          )}
        </div>

        {/* Podgląd ćwiczeń i odpowiedzi */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-content-muted">
            Twoje przesłane odpowiedzi ({task.sentences.length})
          </h3>
          <div className="space-y-3">
            {task.sentences.map((sentence, idx) => {
              const savedAns = task.studentAnswers ? (task.studentAnswers as any)[idx] : undefined;
              const evalItem = evalResults[idx];

              return (
                <div
                  key={sentence.id || idx}
                  className="bg-base-200/60 border border-white/10 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono text-primary font-bold">
                      Zadanie {idx + 1}
                    </span>
                    {evalItem && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          evalItem.isCorrect || evalItem.score >= 70
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {evalItem.score !== undefined ? `${evalItem.score}%` : evalItem.isCorrect ? 'Poprawne' : 'Do poprawy'}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-white">
                    {sentence.polishSentence || sentence.question || sentence.incorrectSentence}
                  </p>

                  <div className="pt-2 border-t border-white/5 text-xs">
                    <span className="text-content-muted block mb-1">Twoja odpowiedź:</span>
                    <span className="text-content font-medium">
                      {typeof savedAns === 'object'
                        ? JSON.stringify(savedAns)
                        : String(savedAns || '(brak odpowiedzi)')}
                    </span>
                  </div>

                  {evalItem?.explanation && (
                    <p className="text-xs text-content-muted bg-white/5 p-2 rounded-lg mt-2">
                      💡 {evalItem.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 flex justify-center">
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="px-6 min-h-[3rem] rounded-xl bg-primary text-accent-ink font-bold text-sm shadow-md hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <LogIn size={15} />
            <span>Zaloguj się do pełnego profilu</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. EKRAN SUKCESU PO WYSŁANIU
  if (phase === 'submitted' && task) {
    return shell(
      <div className="w-full space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-base-200/80 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xl">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
            <CheckCircle2 size={36} />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
              Sukces
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Świetna robota, {task.studentName}!
            </h2>
            <p className="text-[15px] text-content-muted max-w-lg mx-auto leading-relaxed">
              Twoja praca domowa została pomyślnie przesłana i zapisana w Twoim profilu kursanta CRIBRO ENGLISH.
            </p>
          </div>

          {finalScore !== null && (
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-base-100/80 border border-primary/30 shadow-inner">
              <Award className="text-primary w-6 h-6" />
              <div className="text-left">
                <span className="text-[11px] uppercase tracking-wider text-content-muted block font-bold">
                  Twój wynik
                </span>
                <span className="text-2xl font-black text-white">
                  {finalScore}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Szczegóły ewaluacji */}
        {evalResults.length > 0 && (
          <div className="text-left space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-content-muted px-1">
              Podsumowanie zadań ({evalResults.length})
            </h3>
            <div className="space-y-3">
              {task.sentences.map((sent, idx) => {
                const ev = evalResults[idx];
                const isGood = ev?.isCorrect || (ev?.score && ev.score >= 70);
                return (
                  <div
                    key={idx}
                    className="bg-base-200/50 border border-white/10 rounded-xl p-4 space-y-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-content-muted">
                        Zadanie {idx + 1}
                      </span>
                      {ev?.score !== undefined && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            isGood
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {ev.score}%
                        </span>
                      )}
                    </div>

                    <p className="font-semibold text-white">
                      {sent.polishSentence || sent.question || sent.incorrectSentence}
                    </p>

                    {ev?.explanation && (
                      <p className="text-xs text-content-muted bg-white/5 p-2 rounded-lg mt-1">
                        💡 {ev.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="w-full sm:w-auto px-6 min-h-[3rem] rounded-xl bg-primary text-accent-ink font-bold text-sm shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            <span>Zaloguj się do platformy</span>
          </button>
        </div>
      </div>
    );
  }

  // 6. ROZWIĄZYWANIE (KROK PO KROKU)
  if (!task || !task.sentences || task.sentences.length === 0) {
    return shell(
      <div className="text-center py-12 text-content-muted">
        Nie znaleziono ćwiczeń w tej pracy domowej.
      </div>
    );
  }

  const currentSentence = task.sentences[currentIndex];
  const exerciseType = currentSentence.type || task.type || 'translation';
  const totalSentences = task.sentences.length;
  const isLast = currentIndex === totalSentences - 1;
  const currentAnswer = answers[currentIndex];

  return shell(
    <div className="w-full space-y-6">
      {/* Nagłówek zadania */}
      <header className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary">
            Cześć, {task.studentName}! 👋
          </span>
          {task.accessExpiresAt && (
            <span className="text-[11px] text-content-muted flex items-center gap-1">
              <Clock size={12} />
              Ważne do: {new Date(task.accessExpiresAt).toLocaleDateString('pl-PL')}
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          {task.title || 'Praca domowa'}
        </h1>
        {task.instructions && (
          <p className="text-sm text-content-muted leading-relaxed bg-base-200/50 border border-white/5 p-3 rounded-xl">
            {task.instructions}
          </p>
        )}
      </header>

      {/* Pasek postępu i kropki nawigacji */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-content-muted">
            Ćwiczenie <strong className="text-white">{currentIndex + 1}</strong> z{' '}
            <strong className="text-white">{totalSentences}</strong>
          </span>
          <span className="text-content-muted font-mono">
            Wypełniono: {answeredCount}/{totalSentences}
          </span>
        </div>

        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalSentences) * 100}%` }}
          />
        </div>

        {/* Miniaturowy selektor pytań */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {task.sentences.map((_, i) => {
            const hasAns = answers[i] !== undefined && answers[i] !== '' && Object.keys(answers[i] || {}).length > 0;
            const isCurrent = i === currentIndex;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`h-7 w-7 rounded-lg text-xs font-mono font-bold transition-all ${
                  isCurrent
                    ? 'bg-primary text-accent-ink ring-2 ring-primary/30'
                    : hasAns
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-base-200 border border-white/10 text-content-muted hover:border-white/20'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Główna karta z ćwiczeniem */}
      <div className="bg-base-200/70 border border-white/10 rounded-2xl p-5 sm:p-7 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
            Ćwiczenie #{currentIndex + 1}
          </span>
          <span className="text-xs text-content-muted uppercase tracking-wider font-semibold">
            {exerciseType === 'translation' && 'Tłumaczenie'}
            {exerciseType === 'word_order' && 'Rozsypanka słowna'}
            {exerciseType === 'multiple_choice' && 'Wybór opcji'}
            {exerciseType === 'fill_in_the_blank' && 'Uzupełnij luki'}
            {exerciseType === 'find_errors' && 'Popraw błąd'}
          </span>
        </div>

        {/* Renderowanie ćwiczenia z komponentu HomeworkExercise */}
        <HomeworkExercise
          type={exerciseType}
          item={currentSentence}
          answer={currentAnswer}
          onChange={handleAnswerChange}
        />
      </div>

      {/* Przyciski nawigacji */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          className="px-4 min-h-[2.85rem] rounded-xl border border-white/15 text-sm font-semibold text-content hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={16} />
          <span>Poprzednie</span>
        </button>

        <div className="flex items-center gap-2">
          {!isLast ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.min(totalSentences - 1, prev + 1))}
              className="px-5 min-h-[2.85rem] rounded-xl bg-primary text-accent-ink text-sm font-bold shadow-md hover:opacity-95 transition-opacity flex items-center gap-1.5"
            >
              <span>Następne</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 min-h-[2.85rem] rounded-xl bg-primary text-accent-ink text-sm font-bold shadow-md hover:opacity-95 transition-opacity flex items-center gap-2"
            >
              <Send size={15} />
              <span>Zakończ i wyślij</span>
            </button>
          )}
        </div>
      </div>

      {/* Skrót do wysłania w dowolnym momencie, jeśli wszystkie są uzupełnione */}
      {!isLast && answeredCount === totalSentences && (
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={handleSubmit}
            className="text-xs text-primary font-bold flex items-center gap-1.5 hover:underline py-1"
          >
            <Send size={13} />
            <span>Wypełniłeś wszystkie ({totalSentences}) ćwiczenia — wyślij pracę teraz</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DirectHomeworkScreen;
