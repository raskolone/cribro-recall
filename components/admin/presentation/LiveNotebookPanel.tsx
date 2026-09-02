import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Volume2, Copy, Check, Sparkles, Clock, 
  Play, Pause, RotateCcw, AlertTriangle, BookMarked, 
  CheckCircle2, FileText, Send, X, MessageSquare, Flame, 
  Layers, ArrowRight
} from 'lucide-react';
import { LiveCorrectionItem, LiveVocabItem } from '../../../types';
import TTSButtons from '../../flashcards/TTSButtons';
import Button from '../../ui/Button';

interface LiveNotebookPanelProps {
  liveNotes: string;
  onChangeLiveNotes: (val: string) => void;
  liveVocab: LiveVocabItem[];
  onChangeLiveVocab: (vocab: LiveVocabItem[]) => void;
  liveCorrections: LiveCorrectionItem[];
  onChangeLiveCorrections: (corrections: LiveCorrectionItem[]) => void;
  studentName?: string | null;
  onPushToLessonRecord?: () => void;
}

export const LiveNotebookPanel: React.FC<LiveNotebookPanelProps> = ({
  liveNotes,
  onChangeLiveNotes,
  liveVocab,
  onChangeLiveVocab,
  liveCorrections,
  onChangeLiveCorrections,
  studentName,
  onPushToLessonRecord
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'vocab' | 'corrections' | 'timer'>('vocab');
  const [newVocabInput, setNewVocabInput] = useState('');
  const [newErrorSaid, setNewErrorSaid] = useState('');
  const [newErrorBetter, setNewErrorBetter] = useState('');
  const [newErrorRule, setNewErrorRule] = useState('');
  const [copied, setCopied] = useState(false);

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 min default
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(s => s - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddVocab = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newVocabInput.trim()) return;

    let term = newVocabInput.trim();
    let translation = '';
    if (term.includes(' - ')) {
      const parts = term.split(' - ');
      term = parts[0].trim();
      translation = parts.slice(1).join(' - ').trim();
    } else if (term.includes(' – ')) {
      const parts = term.split(' – ');
      term = parts[0].trim();
      translation = parts.slice(1).join(' – ').trim();
    }

    const newItem: LiveVocabItem = {
      id: `lv-${Date.now()}`,
      term,
      translation,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    onChangeLiveVocab([newItem, ...liveVocab]);
    setNewVocabInput('');
  };

  const handleAddCorrection = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newErrorBetter.trim()) return;

    const newItem: LiveCorrectionItem = {
      id: `lc-${Date.now()}`,
      studentSaid: newErrorSaid.trim() || 'Błąd wymowy / struktury',
      betterWay: newErrorBetter.trim(),
      explanation: newErrorRule.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    onChangeLiveCorrections([newItem, ...liveCorrections]);
    setNewErrorSaid('');
    setNewErrorBetter('');
    setNewErrorRule('');
  };

  const handleCopyAllNotes = () => {
    let summary = `📋 NOTATKI Z LEKCJI LIVE ${studentName ? `• ${studentName}` : ''}\n\n`;
    
    if (liveVocab.length > 0) {
      summary += `🔤 NOWE SŁOWNICTWO:\n`;
      liveVocab.forEach(v => {
        summary += `• ${v.term} ${v.translation ? `- ${v.translation}` : ''}\n`;
      });
      summary += '\n';
    }

    if (liveCorrections.length > 0) {
      summary += `💡 POPRAWKI I UWAGI:\n`;
      liveCorrections.forEach(c => {
        summary += `❌ ${c.studentSaid}  ➜  ✅ ${c.betterWay}${c.explanation ? ` (${c.explanation})` : ''}\n`;
      });
      summary += '\n';
    }

    if (liveNotes.trim()) {
      summary += `📝 NOTATKI OGÓLNE:\n${liveNotes}\n`;
    }

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col h-full bg-base-200/90 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
      {/* Header with Tabs */}
      <div className="p-3 border-b border-white/10 bg-base-300/80 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('vocab')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'vocab'
                ? 'bg-primary text-accent-ink shadow-[0_0_12px_rgba(114,240,180,0.3)]'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <BookMarked size={14} />
            <span>Słówka ({liveVocab.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('corrections')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'corrections'
                ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <AlertTriangle size={14} />
            <span>Poprawki ({liveCorrections.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-info text-black shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText size={14} />
            <span>Brudnopis</span>
          </button>
          <button
            onClick={() => setActiveTab('timer')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'timer'
                ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                : 'text-content-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock size={14} />
            <span>{formatTimer(timerSeconds)}</span>
          </button>
        </div>

        <button
          onClick={handleCopyAllNotes}
          className="p-1.5 rounded-lg bg-base-100 hover:bg-white/10 text-content-muted hover:text-white transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer border border-white/5"
          title="Kopiuj całe podsumowanie notatnika"
        >
          {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
          <span className="hidden sm:inline">{copied ? 'Skopiowano!' : 'Kopiuj'}</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* TAB 1: VOCABULARY CATCHER */}
        {activeTab === 'vocab' && (
          <div className="space-y-3">
            <form onSubmit={handleAddVocab} className="flex gap-2">
              <input
                type="text"
                value={newVocabInput}
                onChange={e => setNewVocabInput(e.target.value)}
                placeholder="Wpisz nowe słówko (np. elaborate - rozwinąć myśli)..."
                className="flex-1 bg-base-300/90 border border-white/15 rounded-xl px-3.5 py-2 text-white text-xs placeholder:text-content-muted focus:outline-none focus:border-primary"
              />
              <Button type="submit" size="sm" variant="primary" className="text-xs px-3">
                <Plus size={14} /> Dodaj
              </Button>
            </form>

            {liveVocab.length === 0 ? (
              <div className="py-8 text-center text-content-muted text-xs border border-dashed border-white/10 rounded-2xl p-4">
                <BookMarked size={28} className="mx-auto mb-2 opacity-30" />
                <p>Brak zapisanych słówek w tej sesji.</p>
                <p className="text-[11px] opacity-70 mt-1">Wpisuj nowe frazy pojawiające się w trakcie rozmowy.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {liveVocab.map(v => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-base-300/70 border border-white/10 flex items-center justify-between gap-3 group hover:border-primary/30 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm">{v.term}</span>
                        {v.translation && (
                          <span className="text-xs text-amber-300 font-medium truncate">
                            — {v.translation}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-content-muted font-mono">{v.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <TTSButtons text={v.term} size="sm" />
                      <button
                        onClick={() => onChangeLiveVocab(liveVocab.filter(item => item.id !== v.id))}
                        className="p-1 text-content-muted hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Usuń słówko"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CORRECTIONS */}
        {activeTab === 'corrections' && (
          <div className="space-y-3">
            <form onSubmit={handleAddCorrection} className="p-3.5 rounded-2xl bg-base-300/80 border border-white/10 space-y-2.5">
              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-rose-300 block mb-1">
                  Kursant powiedział (Błąd):
                </label>
                <input
                  type="text"
                  value={newErrorSaid}
                  onChange={e => setNewErrorSaid(e.target.value)}
                  placeholder="np. He don't like it..."
                  className="w-full bg-base-200 border border-rose-400/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-content-muted focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-emerald-300 block mb-1">
                  Poprawna wersja (Natural English):
                </label>
                <input
                  type="text"
                  value={newErrorBetter}
                  onChange={e => setNewErrorBetter(e.target.value)}
                  placeholder="np. He doesn't like it..."
                  className="w-full bg-base-200 border border-emerald-400/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-content-muted focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={newErrorRule}
                  onChange={e => setNewErrorRule(e.target.value)}
                  placeholder="Krótka reguła (opcjonalnie, np. 3rd person singular)..."
                  className="w-full bg-base-200 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-content-muted placeholder:text-content-muted/60 focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" variant="secondary" className="text-xs font-bold flex items-center gap-1.5 bg-rose-500/20 text-rose-200 border-rose-500/30 hover:bg-rose-500/30">
                  <Plus size={14} /> Zapisz poprawkę
                </Button>
              </div>
            </form>

            {liveCorrections.length === 0 ? (
              <div className="py-8 text-center text-content-muted text-xs border border-dashed border-white/10 rounded-2xl p-4">
                <AlertTriangle size={28} className="mx-auto mb-2 opacity-30" />
                <p>Brak zapisanych poprawek.</p>
                <p className="text-[11px] opacity-70 mt-1">Rejestruj pomyłki językowe kursanta, aby utrwalić poprawny wzorzec.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {liveCorrections.map(c => (
                  <div key={c.id} className="p-3.5 rounded-xl bg-base-300/70 border border-white/10 space-y-1.5 group hover:border-white/20 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="text-xs text-rose-300/90 line-through">❌ {c.studentSaid}</div>
                        <div className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                          <span>✅ {c.betterWay}</span>
                          <TTSButtons text={c.betterWay} size="sm" />
                        </div>
                      </div>
                      <button
                        onClick={() => onChangeLiveCorrections(liveCorrections.filter(item => item.id !== c.id))}
                        className="p-1 text-content-muted hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {c.explanation && (
                      <p className="text-[11px] text-content-muted pt-1 border-t border-white/5">
                        💡 {c.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FREEFORM NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-2 h-full flex flex-col">
            <div className="flex items-center gap-1 flex-wrap pb-1">
              <button
                type="button"
                onClick={() => onChangeLiveNotes(liveNotes + '\n- ')}
                className="px-2 py-1 rounded bg-base-300 text-[11px] text-content-muted hover:text-white font-mono"
              >
                • Lista
              </button>
              <button
                type="button"
                onClick={() => onChangeLiveNotes(liveNotes + '\n### ')}
                className="px-2 py-1 rounded bg-base-300 text-[11px] text-content-muted hover:text-white font-mono"
              >
                Nagłówek
              </button>
              <button
                type="button"
                onClick={() => onChangeLiveNotes(liveNotes + '\n**Ważne:** ')}
                className="px-2 py-1 rounded bg-base-300 text-[11px] text-content-muted hover:text-white font-mono"
              >
                **Wytłuszczenie**
              </button>
            </div>
            <textarea
              value={liveNotes}
              onChange={e => onChangeLiveNotes(e.target.value)}
              placeholder="Wspólny brudnopis notatek na żywo (obsługuje Markdown)..."
              rows={12}
              className="w-full flex-1 bg-base-300/90 border border-white/15 rounded-xl p-3 text-white text-xs leading-relaxed font-mono focus:outline-none focus:border-info"
            />
          </div>
        )}

        {/* TAB 4: LESSON TIMER & STOPWATCH */}
        {activeTab === 'timer' && (
          <div className="p-6 text-center space-y-6 flex flex-col items-center justify-center">
            <div className="font-mono text-5xl md:text-6xl font-extrabold text-white tracking-widest py-4 px-6 rounded-3xl bg-base-300/90 border border-white/15 shadow-inner">
              {formatTimer(timerSeconds)}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant={isTimerRunning ? 'secondary' : 'primary'}
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="px-6 py-2.5 text-sm font-bold flex items-center gap-2"
              >
                {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
                {isTimerRunning ? 'Pauza' : 'Start'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(300);
                }}
                className="p-2.5 text-content-muted hover:text-white"
                title="Resetuj timer"
              >
                <RotateCcw size={18} />
              </Button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {[60, 120, 300, 600, 900].map(sec => (
                <button
                  key={sec}
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(sec);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    timerSeconds === sec
                      ? 'bg-amber-400 text-black'
                      : 'bg-base-300 text-content-muted hover:text-white'
                  }`}
                >
                  {sec / 60} min
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {onPushToLessonRecord && (
        <div className="p-3 border-t border-white/10 bg-base-300/60 flex items-center justify-between gap-2">
          <span className="text-[11px] text-content-muted">
            {liveVocab.length} słówek • {liveCorrections.length} poprawek
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={onPushToLessonRecord}
            className="text-xs font-bold text-primary hover:bg-primary/15 border-primary/30 flex items-center gap-1.5"
          >
            <Layers size={13} /> Przenieś do Dziennika lekcji
          </Button>
        </div>
      )}
    </div>
  );
};
