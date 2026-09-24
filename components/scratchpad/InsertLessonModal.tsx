import React, { useState } from 'react';
import {
  Calendar,
  FileText,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  ChevronDown,
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

const InsertLessonModal: React.FC<InsertLessonModalProps> = ({
  isOpen,
  onClose,
  recentLessons,
  studentLevel,
  nextLessonNumber,
  onInsertClean,
  onInsertWithQuickRecall,
}) => {
  const [topic, setTopic] = useState('');
  const [addQuickRecall, setAddQuickRecall] = useState(recentLessons.length > 0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedRecallType, setSelectedRecallType] = useState<RecallType>('auto');
  const [isGenerating, setIsGenerating] = useState(false);

  useEscapeModal(isOpen, onClose, 10);

  if (!isOpen) return null;

  const reset = () => {
    setTopic('');
    setAddQuickRecall(recentLessons.length > 0);
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
    if (!addQuickRecall || !selectedLesson) {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-lg p-6 bg-base-100 border border-white/10 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-hi">
                Nowa lekcja {nextLessonNumber ? `(Lesson ${nextLessonNumber})` : ''}
              </h3>
              <p className="text-xs text-content-muted">
                Wstawianie nowego wpisu lekcyjnego do notatnika
              </p>
            </div>
          </div>
          {studentLevel && (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-base-200 border border-white/10 text-content-muted">
              {studentLevel}
            </span>
          )}
        </div>

        {/* Pole: Opcjonalny temat lekcji */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-content-muted mb-1.5">
            Temat lekcji (opcjonalnie):
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="np. Business Negotiations, Travel & Small Talk..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-base-200 border border-white/10 text-sm text-text-hi placeholder-content-muted/50 focus:outline-none focus:border-primary transition-colors"
          />
          <p className="text-[11px] text-content-muted mt-1">
            Tytuł w notatniku: {topic.trim() ? `Lesson ${nextLessonNumber || 'N'} — ${topic.trim()}` : `Lesson ${nextLessonNumber || 'N'} — dzisiejsza data`}
          </p>
        </div>

        {/* Przełącznik: Add Quick Recall */}
        {recentLessons.length > 0 ? (
          <div className="mb-4 p-3.5 rounded-xl bg-base-200/60 border border-white/10">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Zap size={18} className={addQuickRecall ? 'text-primary' : 'text-content-muted'} />
                <div>
                  <div className="text-sm font-semibold text-text-hi">
                    Add Quick Recall
                  </div>
                  <div className="text-xs text-content-muted">
                    Krótka powtórka aktywnego języka z poprzednich zajęć
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={addQuickRecall}
                onChange={(e) => setAddQuickRecall(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 text-primary focus:ring-primary/40 bg-base-300"
              />
            </label>

            {addQuickRecall && (
              <div className="mt-4 pt-3.5 border-t border-white/10 space-y-3.5 animate-fade-in">
                {/* 1. Wybór lekcji źródłowej (maks 10) */}
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">
                    Wybierz lekcję źródłową (poprzednie lekcje kursanta):
                  </label>
                  <select
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-base-300 border border-white/10 text-sm text-text-hi focus:outline-none focus:border-primary transition-colors"
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

                {/* Podgląd wybranej lekcji */}
                {selectedLesson && (
                  <div className="p-3 rounded-xl bg-base-300/60 border border-white/5 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-content-muted font-mono text-[11px]">
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
                    <div className="font-semibold text-text-hi text-sm">
                      {selectedLesson.topic || 'Temat ogólny'}
                    </div>
                    {selectedLesson.lessonSummary && (
                      <p className="text-content-muted line-clamp-2 italic">
                        „{selectedLesson.lessonSummary}”
                      </p>
                    )}
                    {selectedLesson.vocabularyText && (
                      <div className="text-[11px] text-content-muted/80 line-clamp-1">
                        Słownictwo: {selectedLesson.vocabularyText.replace(/\n/g, ', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Wybór typu Recall */}
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1.5">
                    Typ ćwiczenia Quick Recall:
                  </label>
                  <select
                    value={selectedRecallType}
                    onChange={(e) => setSelectedRecallType(e.target.value as RecallType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-base-300 border border-white/10 text-sm text-text-hi focus:outline-none focus:border-primary transition-colors"
                  >
                    {RECALL_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label} — {type.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {isA1A2 && (
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary flex items-start gap-2">
                    <Sparkles size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <strong>Adaptacja A1/A2:</strong> Generator utworzy max 3 zwięzłe elementy z gotowymi modelami zdań (Useful frames) i prostą formą odpowiedzi.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 p-3.5 rounded-xl bg-base-200/40 border border-white/5 text-xs text-content-muted">
            Brak wcześniejszych lekcji kursanta w bazie. Wstawiony zostanie czysty szablon z sekcją Quick Recall gotową do uzupełnienia.
          </div>
        )}

        {/* Przyciski akcji */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <Button variant="ghost" onClick={close} disabled={isGenerating}>
            Anuluj
          </Button>

          {addQuickRecall && recentLessons.length > 0 ? (
            <>
              <Button
                variant="secondary"
                onClick={handleClean}
                disabled={isGenerating}
              >
                <FileText size={15} />
                Wstaw bez powtórki
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={isGenerating}
                isLoading={isGenerating}
              >
                <Sparkles size={15} />
                Generuj z Quick Recall
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={handleClean} disabled={isGenerating}>
              <FileText size={15} />
              Wstaw nową lekcję
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default InsertLessonModal;

