import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { 
  Trophy, 
  Flame, 
  Target, 
  BookOpen, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  GraduationCap, 
  Lightbulb, 
  Calendar, 
  Award,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { PracticeLog, TranslationEvaluationResult } from '../../types';
import i18n from 'i18next';

// Helper to format local date keys (YYYY-MM-DD)
function getLocalDateKey(dateInput: string | Date): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

// Speech Bubble Info Tooltip Component for individual sentences
interface SpeechBubbleInfoProps {
  isCorrect: boolean;
  explanation?: string;
  feedbackRule?: string;
  feedbackSyntax?: string;
  feedbackVocab?: string;
  polishSentence?: string;
  studentAnswer?: string;
  correctTranslation?: string;
}

const SpeechBubbleInfo: React.FC<SpeechBubbleInfoProps> = ({
  isCorrect,
  explanation,
  feedbackRule,
  feedbackSyntax,
  feedbackVocab,
  polishSentence,
  studentAnswer,
  correctTranslation
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine speech bubble text
  const getTeacherMessage = () => {
    if (isCorrect) {
      if (explanation && explanation.trim().length > 5) {
        return explanation;
      }
      return "Gratulacje! Twoje tłumaczenie jest precyzyjne i w 100% poprawne. Doskonale opanowałeś szyk zdań oraz właściwy dobór słownictwa!";
    } else {
      const parts = [];
      if (explanation && explanation.trim()) parts.push(explanation);
      if (feedbackRule && feedbackRule.trim()) parts.push(`Zasada: ${feedbackRule}`);
      if (feedbackSyntax && feedbackSyntax.trim()) parts.push(`Składnia: ${feedbackSyntax}`);
      if (feedbackVocab && feedbackVocab.trim()) parts.push(`Słownictwo: ${feedbackVocab}`);

      if (parts.length > 0) {
        return parts.join("\n\n");
      }
      return "Przeanalizuj uważnie wzorcowe tłumaczenie. Zwróć uwagę na poprawny czas gramatyczny, szyk wyrazów w zdaniu angielskim oraz właściwe przyimki.";
    }
  };

  const teacherMessage = getTeacherMessage();

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Information Trigger Button (Letter 'I' / 'i') */}
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Informacja od nauczyciela"
        className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs transition-all transform hover:scale-110 active:scale-95 shadow-md ${
          isCorrect
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 animate-pulse'
        }`}
      >
        {isCorrect ? 'i' : 'I'}
      </button>

      {/* Speech Bubble Tooltip */}
      {isOpen && (
        <div 
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 sm:w-80 p-4 rounded-2xl bg-slate-900/95 border border-white/15 backdrop-blur-md shadow-2xl text-left text-xs animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
          style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}
        >
          {/* Triangle tail pointing down */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-900" />

          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
            <span className="text-base">{isCorrect ? '🎉' : '👨‍🏫'}</span>
            <span className={`font-bold uppercase tracking-wider text-[11px] ${isCorrect ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isCorrect ? 'Komentarz Nauczyciela AI' : 'Wskazówka Nauczyciela AI'}
            </span>
          </div>

          <p className="text-gray-200 leading-relaxed whitespace-pre-line font-medium">
            {teacherMessage}
          </p>

          {!isCorrect && correctTranslation && (
            <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-emerald-300">
              <span className="font-semibold text-gray-400 block">Wzorcowe zdanie:</span>
              <span className="italic font-mono">{correctTranslation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StudentStatsScreen: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // AI Teacher Commentary state
  const [aiAnalysis, setAiAnalysis] = useState<{
    overallTeacherCommentary: string;
    keyStrengths: string[];
    areasToImprove: string[];
    pedagogicalTip: string;
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Expanded log session IDs
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user?.id) return;
      try {
        const q = query(
          collection(db, `users/${user.id}/practiceLogs`),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetchedLogs: PracticeLog[] = [];
        snapshot.forEach(docSnap => {
          fetchedLogs.push({ id: docSnap.id, ...docSnap.data() } as PracticeLog);
        });
        setLogs(fetchedLogs);
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [user?.id]);

  // Compute stats: active streak, longest streak, avg score, total sentences translated
  const stats = useMemo(() => {
    let totalScoreSum = 0;
    let totalSentences = 0;

    // Collect distinct local dates
    const dateMap = new Map<string, number>();
    logs.forEach(l => {
      if ((l.exerciseType as string) === 'Aktywność') return;
      totalScoreSum += (Number(l.score) || 0);

      // Count sentences
      if (l.exerciseType === 'ai_translation') {
        let count = 0;
        if (l.totalWords) {
          count = l.totalWords;
        } else if (Array.isArray(l.exercisesData)) {
          count = l.exercisesData.length;
        } else if (typeof l.exercisesData === 'string') {
          if (l.exercisesData.includes(' | ')) {
            count = l.exercisesData.split(' | ').length;
          } else {
            try {
              const parsed = JSON.parse(l.exercisesData);
              if (Array.isArray(parsed)) count = parsed.length;
            } catch {}
          }
        }
        totalSentences += count;
      }

      const dateKey = getLocalDateKey(l.date);
      if (dateKey) {
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
      }
    });

    const validLogs = logs.filter(l => (l.exerciseType as string) !== 'Aktywność');
    const rawAvg = validLogs.length > 0 ? totalScoreSum / validLogs.length : 0;
    const averageScore = isNaN(rawAvg) ? 0 : Math.round(rawAvg);

    // Calculate streaks using calendar dates
    const dateKeys = Array.from(dateMap.keys()).sort(); // ascending YYYY-MM-DD

    let currentStreak = 0;
    let longestStreak = 0;

    if (dateKeys.length > 0) {
      let tempStreak = 0;
      let prevTimestamp: number | null = null;

      dateKeys.forEach(dateStr => {
        const parts = dateStr.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const timestamp = d.getTime();

        if (prevTimestamp === null) {
          tempStreak = 1;
        } else {
          const diffDays = Math.round((timestamp - prevTimestamp) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            tempStreak++;
          } else if (diffDays > 1) {
            if (tempStreak > longestStreak) longestStreak = tempStreak;
            tempStreak = 1;
          }
        }
        prevTimestamp = timestamp;
      });
      if (tempStreak > longestStreak) longestStreak = tempStreak;

      // Active current streak check (is today or yesterday practiced?)
      const todayKey = getLocalDateKey(new Date());
      const yesterdayKey = getLocalDateKey(new Date(Date.now() - 86400000));
      
      const setOfDates = new Set(dateKeys);

      let anchorDateMs: number | null = null;
      if (setOfDates.has(todayKey)) {
        anchorDateMs = new Date().setHours(0,0,0,0);
      } else if (setOfDates.has(yesterdayKey)) {
        anchorDateMs = new Date(Date.now() - 86400000).setHours(0,0,0,0);
      }

      if (anchorDateMs !== null) {
        let activeCount = 0;
        let checkMs = anchorDateMs;
        while (true) {
          const key = getLocalDateKey(new Date(checkMs));
          if (setOfDates.has(key)) {
            activeCount++;
            checkMs -= 86400000;
          } else {
            break;
          }
        }
        currentStreak = activeCount;
      } else {
        currentStreak = 0;
      }
    }

    return {
      totalExercises: validLogs.length,
      averageScore,
      totalWords: totalSentences,
      currentStreak,
      longestStreak
    };
  }, [logs]);

  // Sync user doc streak and translated sentences count if out of sync
  useEffect(() => {
    if (user?.id && !isLoading) {
      const needsStreakUpdate = user.streakCount !== stats.currentStreak;
      const needsSentencesUpdate = user.translatedSentencesCount !== stats.totalWords;

      if (needsStreakUpdate || needsSentencesUpdate) {
        updateDoc(doc(db, 'users', user.id), {
          streakCount: stats.currentStreak,
          translatedSentencesCount: stats.totalWords
        }).catch(err => console.error("Error syncing stats to user doc:", err));
      }
    }
  }, [user?.id, isLoading, stats.currentStreak, stats.totalWords, user?.streakCount, user?.translatedSentencesCount]);

  // Load or fetch AI Teacher Commentary
  const fetchTeacherCommentary = async () => {
    if (!logs || logs.length === 0) return;
    setIsAiLoading(true);
    setAiError(null);

    try {
      // Build a summary of recent logs and mistakes to send to AI teacher
      const recentLogs = logs.slice(0, 8);
      let logsSummary = recentLogs.map((l, i) => {
        let items: TranslationEvaluationResult[] = [];
        if (Array.isArray(l.exercisesData)) items = l.exercisesData;
        else if (typeof l.exercisesData === 'string') {
          try { items = JSON.parse(l.exercisesData); } catch {}
        } else if (Array.isArray(l.detailedFeedback)) {
          items = l.detailedFeedback;
        }

        const itemsSummary = items.map(item => 
          `- [${item.isCorrect ? 'POPRAWNE' : 'BŁĄD'}] PL: "${item.polishSentence}" | Uczeń: "${item.studentAnswer}" | Poprawnie: "${item.correctTranslation}" ${item.explanation ? `(Komentarz: ${item.explanation})` : ''}`
        ).join('\n');

        return `Sesja ${i + 1} (${new Date(l.date).toLocaleDateString()}): Wynik ${l.score || 0}%\n${itemsSummary}`;
      }).join('\n\n');

      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : '';

      const res = await fetch('/api/gemini/student-stats-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          stats,
          logsSummary,
          language
        })
      });

      if (!res.ok) {
        throw new Error("Failed to fetch teacher commentary");
      }

      const data = await res.json();
      setAiAnalysis(data);
      // Cache in localStorage
      (function(){ try { localStorage.setItem(`ai_teacher_stats_${user?.id}`, JSON.stringify({ data, timestamp: Date.now() })); } catch(e) {} })();
    } catch (err: any) {
      console.error(err);
      setAiError(language === 'pl' ? 'Nie udało się pobrać komentarza nauczyciela AI.' : 'Could not fetch AI teacher commentary.');
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && logs.length > 0 && !aiAnalysis && !isAiLoading) {
      const cached = (function(){ try { return localStorage.getItem(`ai_teacher_stats_${user.id}`); } catch(e) { return null; } })();
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // 24 hour cache expiry
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            setAiAnalysis(parsed.data);
            return;
          }
        } catch {}
      }
      fetchTeacherCommentary();
    }
  }, [user?.id, logs.length]);

  const toggleExpandLog = (logId: string) => {
    setExpandedLogIds(prev => ({ ...prev, [logId]: !prev[logId] }));
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-8 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto animate-fade-in space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-primary" />
            {language === 'pl' ? 'Statystyki i Podsumowanie Pracy' : 'Statistics & Work Summary'}
          </h1>
          <p className="text-content-muted text-sm mt-1">
            {language === 'pl' 
              ? 'Podejrzyj wyniki wszystkich swoich ćwiczeń oraz podsumowanie swojej pracy przygotowane przez AI.' 
              : 'Review your exercise results and work summary prepared by AI.'}
          </p>
        </div>
      </div>

      {/* Top Numeric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <Card className="p-6 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border-amber-500/30 relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400 border border-amber-500/30">
              <Flame size={28} className={stats.currentStreak > 0 ? "animate-bounce text-amber-400" : "text-gray-400"} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300/80 mb-1">
                {language === 'pl' ? 'Obecny Streak' : 'Current Streak'}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-white">{stats.currentStreak}</h3>
                <span className="text-xs font-bold text-amber-400/90">{language === 'pl' ? 'dni z rzędu' : 'days streak'} 🔥</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Longest Streak */}
        <Card className="p-6 bg-gradient-to-br from-yellow-500/15 via-amber-600/10 to-transparent border-yellow-500/30 relative overflow-hidden group hover:border-yellow-500/50 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-2xl text-yellow-400 border border-yellow-500/30">
              <Trophy size={28} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-yellow-300/80 mb-1">
                {language === 'pl' ? 'Najdłuższy Streak' : 'Longest Streak'}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-white">{stats.longestStreak}</h3>
                <span className="text-xs font-bold text-yellow-400/90">{language === 'pl' ? 'dni' : 'days'} 🏆</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Average Score */}
        <Card className="p-6 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border-emerald-500/30 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 border border-emerald-500/30">
              <Target size={28} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300/80 mb-1">
                {language === 'pl' ? 'Średni Wynik' : 'Average Score'}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-white">{stats.averageScore}%</h3>
                <span className="text-xs font-bold text-emerald-400/90">{language === 'pl' ? 'poprawności' : 'accuracy'} 🎯</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Total Translated Sentences */}
        <Card className="p-6 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent border-indigo-500/30 relative overflow-hidden group hover:border-indigo-500/50 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/30">
              <BookOpen size={28} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-300/80 mb-1">
                {language === 'pl' ? 'Przetłumaczone Zdania' : 'Translated Sentences'}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-white">{stats.totalWords}</h3>
                <span className="text-xs font-bold text-indigo-300/90">{language === 'pl' ? 'zdań' : 'sentences'} ✨</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION: AI Teacher Commentary Panel */}
      <div className="liquid-glass-card p-6 md:p-8 rounded-3xl border border-primary/30 shadow-[0_0_30px_rgba(114,240,180,0.1)] relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/20 text-primary border border-primary/40 shadow-sm">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {language === 'pl' ? 'Podsumowanie mojej pracy' : 'Summary of my work'}
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              </h2>
              <p className="text-xs text-content-muted">
                {language === 'pl' 
                  ? 'Szybkie podsumowanie Twoich postępów, opanowanych struktur oraz wskazówek językowych od AI.' 
                  : 'Quick summary of your progress, mastered structures, and language tips from AI.'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={fetchTeacherCommentary}
            isLoading={isAiLoading}
            className="self-start sm:self-auto text-xs flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : ''}`} />
            {language === 'pl' ? 'Odśwież analizę' : 'Refresh Feedback'}
          </Button>
        </div>

        {isAiLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-content-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {language === 'pl' ? 'Nauczyciel AI analizuje Twoje wykonane zdania...' : 'AI Teacher is analyzing your translated sentences...'}
            </p>
          </div>
        ) : aiError ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm flex items-center justify-between">
            <p>{aiError}</p>
            <Button variant="secondary" onClick={fetchTeacherCommentary} className="text-xs">
              {language === 'pl' ? 'Spróbuj ponownie' : 'Retry'}
            </Button>
          </div>
        ) : aiAnalysis ? (
          <div className="space-y-6">
            {/* Overall Commentary Paragraphs */}
            <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                {language === 'pl' ? 'Podsumowanie Dydaktyczne' : 'Pedagogical Overview'}
              </h3>
              <div className="text-sm md:text-base text-gray-200 leading-relaxed whitespace-pre-line font-normal">
                {aiAnalysis.overallTeacherCommentary}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Key Strengths */}
              {aiAnalysis.keyStrengths && aiAnalysis.keyStrengths.length > 0 && (
                <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20 space-y-3">
                  <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {language === 'pl' ? 'Mocne Strony' : 'Key Strengths'}
                  </h4>
                  <ul className="space-y-2">
                    {aiAnalysis.keyStrengths.map((str, idx) => (
                      <li key={idx} className="text-xs md:text-sm text-emerald-100 flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas to Improve */}
              {aiAnalysis.areasToImprove && aiAnalysis.areasToImprove.length > 0 && (
                <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20 space-y-3">
                  <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    {language === 'pl' ? 'Obszary do Wyszkolenia' : 'Areas to Improve'}
                  </h4>
                  <ul className="space-y-2">
                    {aiAnalysis.areasToImprove.map((area, idx) => (
                      <li key={idx} className="text-xs md:text-sm text-amber-100 flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Pedagogical Tip */}
            {aiAnalysis.pedagogicalTip && (
              <div className="bg-gradient-to-r from-primary/20 to-emerald-500/20 p-4 md:p-5 rounded-2xl border border-primary/30 flex items-start gap-3">
                <Lightbulb className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                    {language === 'pl' ? 'Wskazówka Metodyczna' : 'Methodical Tip'}
                  </h4>
                  <p className="text-xs md:text-sm text-gray-200 font-medium">
                    {aiAnalysis.pedagogicalTip}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-content-muted text-sm">
            {language === 'pl' 
              ? 'Rozpocznij wykonywanie ćwiczeń, aby otrzymać spersonalizowaną analizę od nauczyciela.' 
              : 'Complete exercises to generate personalized feedback from your AI teacher.'}
          </div>
        )}
      </div>

      {/* SECTION: Exercise History & Detailed Sentences Breakdown */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center justify-between border-b border-white/10 pb-3">
          <span className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {language === 'pl' ? 'Wyniki Wszystkich Wykonanych Ćwiczeń' : 'Results of All Completed Exercises'}
          </span>
          <span className="text-xs text-content-muted font-normal">
            {logs.length} {language === 'pl' ? 'sesji' : 'sessions'}
          </span>
        </h2>

        {logs.length === 0 ? (
          <Card className="p-8 text-center text-content-muted">
            <p className="text-base font-medium">
              {language === 'pl' ? 'Brak historii wykonanych ćwiczeń.' : 'No completed exercises yet.'}
            </p>
            <p className="text-xs mt-1">
              {language === 'pl' ? 'Przejdź do zakładki ćwiczeń i wykonaj swój pierwszy trening!' : 'Go to practice section and start your first lesson!'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {logs.map(log => {
              const isExpanded = !!expandedLogIds[log.id];

              // Parse items / exercises detailed feedback
              let sentenceItems: TranslationEvaluationResult[] = [];
              if (Array.isArray(log.exercisesData)) {
                sentenceItems = log.exercisesData;
              } else if (typeof log.exercisesData === 'string') {
                try { sentenceItems = JSON.parse(log.exercisesData); } catch {}
              } else if (Array.isArray(log.detailedFeedback)) {
                sentenceItems = log.detailedFeedback;
              }

              const formattedDate = new Date(log.date).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              const isSuccess = (log.score || 0) >= 80;

              return (
                <div 
                  key={log.id} 
                  className="liquid-glass-card p-5 md:p-6 rounded-2xl border border-white/10 space-y-4 transition-all hover:border-white/20"
                >
                  {/* Session Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${
                        isSuccess 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">
                            {log.testName || (language === 'pl' ? 'Sesja Tłumaczeniowa AI' : 'AI Translation Practice')}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                            isSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {log.score || 0}%
                          </span>
                        </div>
                        <p className="text-xs text-content-muted mt-0.5 flex items-center gap-2">
                          <span>{formattedDate}</span>
                          <span>•</span>
                          <span>{sentenceItems.length || log.totalWords || 1} {language === 'pl' ? 'zdań' : 'sentences'}</span>
                        </p>
                      </div>
                    </div>

                    {sentenceItems.length > 0 && (
                      <Button
                        variant="ghost"
                        onClick={() => toggleExpandLog(log.id)}
                        className="self-end sm:self-auto text-xs flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10"
                      >
                        {isExpanded ? (
                          <>
                            {language === 'pl' ? 'Ukryj szczegóły zdań' : 'Hide Sentences'}
                            <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            {language === 'pl' ? 'Pokaż zdania i komentarze (I)' : 'Show Sentences & Info (I)'}
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Expanded Sentence Breakdown */}
                  {isExpanded && sentenceItems.length > 0 && (
                    <div className="pt-4 border-t border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-xs font-bold uppercase tracking-wider text-content-muted mb-2">
                        {language === 'pl' ? 'Szczegóły zdań (Najedź na literę I aby zobaczyć speech bubble nauczyciela):' : 'Sentence details (Hover icon I to reveal teacher speech bubble):'}
                      </p>

                      <div className="space-y-3">
                        {sentenceItems.map((item, idx) => (
                          <div 
                            key={idx} 
                            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                              item.isCorrect 
                                ? 'bg-emerald-500/5 border-emerald-500/20' 
                                : 'bg-rose-500/5 border-rose-500/20'
                            }`}
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                                <span>Zdanie #{idx + 1} (PL):</span>
                                <span className="text-white font-medium">{item.polishSentence}</span>
                              </div>

                              <div className="flex items-center gap-2 text-xs font-semibold">
                                <span className="text-gray-400">Odpowiedź ucznia:</span>
                                <span className={item.isCorrect ? 'text-emerald-300 font-mono' : 'text-rose-300 font-mono line-through'}>
                                  {item.studentAnswer || '(brak)'}
                                </span>
                              </div>

                              {!item.isCorrect && item.correctTranslation && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                                  <span>Poprawne tłumaczenie:</span>
                                  <span className="font-mono">{item.correctTranslation}</span>
                                </div>
                              )}
                            </div>

                            {/* Speech Bubble Tooltip Trigger Badge */}
                            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                                item.isCorrect ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                              }`}>
                                {item.isCorrect ? (language === 'pl' ? 'Poprawne' : 'Correct') : (language === 'pl' ? 'Błąd' : 'Mistake')}
                              </span>

                              {/* Speech Bubble Info Tooltip */}
                              <SpeechBubbleInfo
                                isCorrect={item.isCorrect}
                                explanation={item.explanation}
                                feedbackRule={item.feedbackRule}
                                feedbackSyntax={item.feedbackSyntax}
                                feedbackVocab={item.feedbackVocab}
                                polishSentence={item.polishSentence}
                                studentAnswer={item.studentAnswer}
                                correctTranslation={item.correctTranslation}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentStatsScreen;
