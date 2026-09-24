import React, { useState } from 'react';
import {
  Calendar,
  FileText,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  ChevronDown,
  HelpCircle,
  X
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { LessonRecord } from '../../types';
import { RecallType, RECALL_TYPE_LABELS } from '../../services/scratchpadAiService';

interface InsertLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Poprzednie rzeczywiste lekcje kursanta (maks. 10), najnowsza pierwsza */
  recentLessons: LessonRecord[];
  studentLevel?: string;
  nextLessonNumber?: number;
  onInsertClean: (topic?: string) => void;
  onInsertWithQuickRecall: (
    lesson: LessonRecord,
    recallType: RecallType,
    topic?: string
  ) => Promise<void> | void;
}

const formatLessonDate = (date: string): string => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
};

const RECALL_TYPES: { id: RecallType; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto-select', desc: 'Automatyczny dobór do materiału z lekcji' },
  { id: 'personal', label: 'Make it personal', desc: 'Pytania do własnych doświadczeń kursanta' },
  { id: 'correct', label: 'Correct the sentence', desc: 'Poprawa błędów z poprzedniej lekcji' },
  { id: 'complete', label: 'Complete the sentence', desc: 'Uzupełnienie zdań brakującymi zwrotami' },
  { id: 'translate', label: 'Translate short sentences', desc: 'Krótkie tłumaczenia PL → EN' },
  { id: 'dialogue', label: 'Mini-dialogue', desc: 'Krótka wymiana zdań z lukami / rolami' },
  { id: 'situation', label: 'Recall from a situation', desc: 'Reakcja na opisaną sytuację' },
];

export const InsertLessonModal: React.FC<InsertLessonModalProps> = ({
  isOpen,
  onClose,
  recentLessons,
  studentLevel,
  nextLessonNumber = 1,
  onInsertClean,
  onInsertWithQuickRecall,
}) => {
  const isFirstLesson = nextLessonNumber <= 1 || recentLessons.length === 0;

  const [topic, setTopic] = useState('');
  const [quickRecallChoice, setQuickRecallChoice] = useState<'yes' | 'no'>('no');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedRecallType, setSelectedRecallType] = useState<RecallType>('auto');
  const [isGenerating, setIsGenerating] = useState(false);

  useEscapeModal(isOpen, onClose, 10);

  if (!isOpen) return null;

  const reset = () => {
    setTopic('');
    setQuickRecallChoice('no');
    setSelectedIndex(0);
    setSelectedRecallType('auto');
    setIsGenerating(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleClean = () => {
    onInsertClean(topic.trim() || undefined);
    close();
  };

  const selectedLesson = recentLessons[selectedIndex];
  const isA1A2 = studentLevel && /^(A1|A2|A1\/A2|dolne A2|A0)$/i.test(studentLevel.trim());

  const handleConfirm = async () => {
    if (isFirstLesson || quickRecallChoice !== 'yes' || !selectedLesson) {
      handleClean();
      return;
    }

    setIsGenerating(true);
    try {
      await onInsertWithQuickRecall(
        selectedLesson,
        selectedRecallType,
        topic.trim() || undefined
      );
    } finally {
      close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <Card className="w-full max-w-lg p-6 bg-ink-2 border border-line-strong shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-hi">
                Nowa lekcja (Lesson {nextLessonNumber})
              </h3>
              <p className="text-xs text-slate-400">
                {isFirstLesson
                  ? 'Pierwszy pusty szablon lekcji dla kursanta'
                  : 'Wstawianie nowego wpisu lekcyjnego do notatnika'}
              </p>
            </div>
          </div>
          {studentLevel && (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white/5 border border-white/10 text-slate-300">
              {studentLevel}
            </span>
          )}
        </div>

        {/* Pole: Opcjonalny temat lekcji */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Temat lekcji (opcjonalnie):
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="np. Business Negotiations, Travel & Small Talk..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-text-hi placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Tytuł w notatniku: {topic.trim() ? `Lesson ${nextLessonNumber} — ${topic.trim()}` : `Lesson ${nextLessonNumber} — dzisiejsza data`}
          </p>
        </div>

        {/* Pierwsza lekcja vs Kolejne lekcje */}
        {isFirstLesson ? (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-slate-300 space-y-1.5">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Pierwsza lekcja kursanta (Lesson 1)
            </div>
            <p className="leading-relaxed">
              Zostanie wstawiony czysty szablon z sekcjami: <strong>QUICK RECALL</strong>, <strong>TODAY’S LESSON</strong>, <strong>LANGUAGE NOTES</strong> oraz <strong>AFTER THE LESSON</strong>.
            </p>
          </div>
        ) : (
          <div className="mb-5 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-hi flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-400" />
                  Czy chcesz dodać Quick Recall z poprzedniej lekcji?
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Krótka powtórka aktywnego języka lub błędów z poprzednich zajęć
                </div>
              </div>
            </div>

            {/* Przyciski wyboru Tak / Nie */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuickRecallChoice('no')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  quickRecallChoice === 'no'
                    ? 'bg-white/15 border-white/30 text-white shadow-sm ring-1 ring-white/40'
                    : 'bg-black/20 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Nie (Pusty Quick Recall)
              </button>
              <button
                type="button"
                onClick={() => setQuickRecallChoice('yes')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  quickRecallChoice === 'yes'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm ring-1 ring-emerald-400/40'
                    : 'bg-black/20 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Tak (Skonfiguruj powtórkę)
              </button>
            </div>

            {/* Konfigurator powtórki po wybraniu Tak */}
            {quickRecallChoice === 'yes' && (
              <div className="pt-3 border-t border-white/10 space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Wybierz lekcję źródłową:
                  </label>
                  <select
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-text-hi focus:outline-none focus:border-emerald-500"
                  >
                    {recentLessons.slice(0, 10).map((lesson, idx) => {
                      const isConfirmed = lesson.status === 'confirmed';
                      return (
                        <option key={lesson.id || idx} value={idx}>
                          {formatLessonDate(lesson.date)} — {lesson.topic || 'Bez tematu'} {isConfirmed ? '✓' : '(szkic)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedLesson && (
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        {formatLessonDate(selectedLesson.date)}
                      </span>
                      {selectedLesson.status === 'confirmed' ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Zatwierdzona
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Clock size={12} /> Szkic
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-text-hi text-xs">
                      {selectedLesson.topic || 'Temat ogólny'}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Typ ćwiczenia Quick Recall:
                  </label>
                  <select
                    value={selectedRecallType}
                    onChange={(e) => setSelectedRecallType(e.target.value as RecallType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-text-hi focus:outline-none focus:border-emerald-500"
                  >
                    {RECALL_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label} — {type.desc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Przyciski akcji */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <Button variant="ghost" onClick={close} disabled={isGenerating}>
            Anuluj
          </Button>

          {quickRecallChoice === 'yes' && recentLessons.length > 0 ? (
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={isGenerating}
              isLoading={isGenerating}
              className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold"
            >
              <Sparkles size={15} />
              Generuj z Quick Recall
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleClean}
              disabled={isGenerating}
              className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold"
            >
              <FileText size={15} />
              {isFirstLesson ? 'Wstaw Lesson 1' : 'Wstaw nową lekcję'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default InsertLessonModal;
