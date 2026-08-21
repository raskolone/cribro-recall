import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { aiMonitor, AIActivityEvent } from '../../services/aiMonitorService';
import { formatAIModelName } from '../../services/geminiService';
import { 
  Sparkles, 
  Cpu, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronUp, 
  Clock, 
  X, 
  RefreshCw, 
  Zap, 
  Volume2, 
  Play
} from 'lucide-react';
import { playSpeech } from '../../services/ttsService';

export const AdminAIActivityMonitor: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [events, setEvents] = useState<AIActivityEvent[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [, setTimeTicker] = useState<number>(Date.now());

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = aiMonitor.subscribe((newEvents, newActiveCount) => {
      setEvents(newEvents);
      setActiveCount(newActiveCount);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Timer for active elapsed duration update
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      setTimeTicker(Date.now());
    }, 150);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Find most recent active event or most recent finished event
  const activeEvent = useMemo(() => {
    return events.find(e => e.status === 'pending' || e.status === 'retrying') || null;
  }, [events]);

  const recentFinishedEvent = useMemo(() => {
    if (activeEvent) return null;
    const finished = events.find(e => e.status === 'success' || e.status === 'error');
    if (finished && finished.completedAt && (Date.now() - finished.completedAt < 6000)) {
      return finished;
    }
    return null;
  }, [events, activeEvent]);

  if (!isAdmin) return null;

  const currentDisplayEvent = activeEvent || recentFinishedEvent;

  const getCategoryBadge = (category?: AIActivityEvent['category']) => {
    switch (category) {
      case 'tts':
        return { label: 'TTS Audio', bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' };
      case 'sentence-gen':
        return { label: 'Zdania AI', bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' };
      case 'evaluation':
        return { label: 'Ocena AI', bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' };
      case 'test':
        return { label: 'Test / Quiz', bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' };
      case 'flashcards':
      case 'autocomplete':
        return { label: 'Fiszki / Słownictwo', bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' };
      case 'stats':
        return { label: 'Pedagogika AI', bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30' };
      default:
        return { label: 'Zapytanie AI', bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' };
    }
  };

  const handleQuickAudioTest = async () => {
    try {
      await playSpeech('Testing AI voice synthesis audio stream and model connectivity.', { accent: 'en-US' });
    } catch (e) {
      console.warn('Audio test failed:', e);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] pointer-events-auto select-none font-sans">
      <AnimatePresence>
        {currentDisplayEvent && !isMinimized && !isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex flex-col items-end gap-2 mb-2"
          >
            <div 
              onClick={() => setIsExpanded(true)}
              className="cursor-pointer group flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0a101d]/95 hover:bg-[#0f172a] border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 shadow-[0_10px_35px_rgba(0,0,0,0.7),0_0_20px_rgba(6,182,212,0.25)] backdrop-blur-xl transition-all duration-300 active:scale-98 max-w-md"
            >
              {/* Pulsing indicator */}
              <div className="flex items-center gap-2 shrink-0">
                {currentDisplayEvent.status === 'pending' || currentDisplayEvent.status === 'retrying' ? (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  </span>
                ) : currentDisplayEvent.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}

                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 group-hover:bg-cyan-500/30 transition-colors">
                  {currentDisplayEvent.category === 'tts' ? (
                    <Volume2 className="w-4 h-4 text-violet-300 animate-pulse" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
                  )}
                </div>
              </div>

              {/* Text info */}
              <div className="flex flex-col text-left overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/95">
                  <span className="text-cyan-400 font-medium">
                    {currentDisplayEvent.status === 'pending' || currentDisplayEvent.status === 'retrying' 
                      ? 'Wysyłam zapytanie do: ' 
                      : currentDisplayEvent.status === 'success'
                      ? 'Otrzymano odpowiedź: '
                      : 'Błąd modelu: '}
                  </span>
                  <strong className="text-white font-bold tracking-wide truncate max-w-[190px]">
                    {formatAIModelName(currentDisplayEvent.currentModel)}
                  </strong>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-cyan-200/85 font-normal truncate max-w-[280px]">
                  <span className="font-medium">{currentDisplayEvent.taskName}</span>
                  <span>•</span>
                  <span className="text-white/70 font-mono">
                    {currentDisplayEvent.status === 'pending' || currentDisplayEvent.status === 'retrying'
                      ? `${((Date.now() - currentDisplayEvent.startedAt) / 1000).toFixed(1)}s`
                      : currentDisplayEvent.durationMs
                      ? `${(currentDisplayEvent.durationMs / 1000).toFixed(1)}s`
                      : '0.0s'}
                  </span>
                  {currentDisplayEvent.status === 'retrying' && (
                    <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      Fallback
                    </span>
                  )}
                </div>
              </div>

              {/* Expand badge */}
              <div className="shrink-0 flex items-center gap-1 pl-1 border-l border-white/10 text-cyan-400/70 group-hover:text-cyan-300">
                <ChevronUp className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button when no active event or when minimized */}
      {(!currentDisplayEvent || isMinimized) && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => {
            setIsMinimized(false);
            setIsExpanded(!isExpanded);
          }}
          title="Panel zapytań AI & Kluczy API (Admin)"
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl backdrop-blur-xl border transition-all duration-300 shadow-xl cursor-pointer ${
            activeCount > 0
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse'
              : 'bg-[#0a101d]/90 hover:bg-[#0f172a] border-white/10 hover:border-cyan-500/40 text-white/70 hover:text-white'
          }`}
        >
          {activeCount > 0 ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
            </span>
          ) : (
            <Cpu className="w-4 h-4 text-cyan-400" />
          )}
          <span className="text-xs font-semibold">AI Live Monitor</span>
          {events.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-cyan-300">
              {events.length}
            </span>
          )}
        </motion.button>
      )}

      {/* Expanded Modal / Drawer Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[92vw] sm:w-[480px] max-h-[600px] flex flex-col rounded-3xl bg-[#090d16]/95 border border-cyan-500/30 text-white shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(6,182,212,0.2)] backdrop-blur-2xl overflow-hidden mt-2"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-cyan-950/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                  <Cpu className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Live Monitor AI & API Keys
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold border border-cyan-500/30">
                      Admin Mode
                    </span>
                  </h4>
                  <p className="text-[11px] text-white/50">Podgląd zapytań tekstowych, testów i syntezy audio w czasie rzeczywistym</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleQuickAudioTest}
                  title="Test syntezy mowy TTS"
                  className="px-2 py-1 rounded-lg text-xs bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 transition-colors flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Test TTS</span>
                </button>
                <button
                  onClick={() => aiMonitor.clearHistory()}
                  title="Wyczyść historię"
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[440px] custom-scrollbar">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 space-y-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-cyan-400">
                    <Zap className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/80">Brak aktywnych zapytań AI w historii.</p>
                    <p className="text-[11px] text-white/40 max-w-xs mt-1">
                      Kliknij dowolne słówko, generuj zadania lub kliknij przycisk „Test TTS” powyżej, aby zobaczyć rejestr zapytań na żywo.
                    </p>
                  </div>
                  <button
                    onClick={handleQuickAudioTest}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-all"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Wypróbuj zapytanie audio TTS
                  </button>
                </div>
              ) : (
                events.map((evt) => {
                  const isPending = evt.status === 'pending' || evt.status === 'retrying';
                  const isSuccess = evt.status === 'success';
                  const elapsed = isPending
                    ? ((Date.now() - evt.startedAt) / 1000).toFixed(1)
                    : evt.durationMs
                    ? (evt.durationMs / 1000).toFixed(1)
                    : '0.0';

                  const badge = getCategoryBadge(evt.category);

                  return (
                    <div
                      key={evt.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isPending
                          ? 'bg-cyan-950/30 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : isSuccess
                          ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
                          : 'bg-rose-950/20 border-rose-500/30'
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {isPending ? (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
                            </span>
                          ) : isSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}

                          <span className="text-xs font-bold text-white truncate">
                            {evt.taskName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-white/50 shrink-0 font-mono">
                          <Clock className="w-3 h-3 text-white/30" />
                          <span>{elapsed}s</span>
                        </div>
                      </div>

                      {/* Model & Key badge */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10.5px] font-semibold">
                          {evt.category === 'tts' ? (
                            <Volume2 className="w-3 h-3 text-violet-300" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-cyan-300" />
                          )}
                          <span>Model: <strong>{formatAIModelName(evt.currentModel)}</strong></span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>

                        {evt.provider && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[10px]">
                            <Key className="w-2.5 h-2.5 text-amber-400" />
                            <span>Klucz: {evt.provider}</span>
                          </div>
                        )}
                      </div>

                      {/* Status message / history */}
                      <p className="text-[11px] text-white/70 leading-relaxed font-sans">
                        {evt.statusMessage}
                      </p>

                      {/* Prompt snippet preview */}
                      {evt.promptSnippet && (
                        <div className="mt-1 text-[10px] text-white/40 italic truncate font-mono bg-black/20 px-2 py-1 rounded-md">
                          "{evt.promptSnippet}"
                        </div>
                      )}

                      {/* Attempt sequence if fallback occurred */}
                      {evt.attemptHistory && evt.attemptHistory.length > 1 && (
                        <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap items-center gap-1 text-[10px] text-white/40">
                          <span className="font-semibold text-cyan-400/80">Sekwencja modeli:</span>
                          {evt.attemptHistory.map((att, idx) => (
                            <React.Fragment key={idx}>
                              <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/60">
                                {formatAIModelName(att.model)}
                              </span>
                              {idx < evt.attemptHistory!.length - 1 && <span>→</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] text-white/40">
              <span>Widok aktywny tylko dla administratorów</span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Zminimalizuj
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
