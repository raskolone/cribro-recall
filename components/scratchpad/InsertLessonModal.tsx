import React, { useState } from 'react';
import { Calendar, FileText, RefreshCw, Sparkles } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { LessonRecord } from '../../types';

interface InsertLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ostatnie zatwierdzone lekcje kursanta, najnowsza pierwsza — max 3. */
  recentLessons: LessonRecord[];
  onInsertClean: () => void;
  onInsertWithRevision: (lesson: LessonRecord) => Promise<void> | void;
}

const formatLessonDate = (date: string): string => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** 2-3 przykładowe punkty ze słownictwa lekcji, do podglądu w karcie. */
const previewLines = (lesson: LessonRecord): string[] =>
  (lesson.vocabularyText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);

/**
 * Bramka potwierdzenia przed wstawieniem nowej lekcji do notatnika.
 *
 * Wcześniej kliknięcie „Nowa lekcja" od razu pytało AI o powtórkę na
 * podstawie treści poprzedniej lekcji W TYM SAMYM dokumencie — przy
 * wprowadzaniu zaległych lekcji (nie po kolei) to dawało powtórkę z
 * przypadkowej, ostatnio wpisanej lekcji, nie z faktycznie poprzedzającej.
 * Krok 2 pokazuje lektorowi, z KTÓREJ zatwierdzonej lekcji (`lessonRecords`)
 * powtórka by powstała, zanim cokolwiek wywoła model.
 */
const InsertLessonModal: React.FC<InsertLessonModalProps> = ({
  isOpen,
  onClose,
  recentLessons,
  onInsertClean,
  onInsertWithRevision,
}) => {
  const [step, setStep] = useState<'mode' | 'confirm'>('mode');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useEscapeModal(isOpen, onClose, 10);

  if (!isOpen) return null;

  const reset = () => {
    setStep('mode');
    setSelectedIndex(0);
    setIsGenerating(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const insertClean = () => {
    onInsertClean();
    close();
  };

  const selectedLesson = recentLessons[selectedIndex];

  const generateRevision = async () => {
    if (!selectedLesson || isGenerating) return;
    setIsGenerating(true);
    try {
      await onInsertWithRevision(selectedLesson);
    } finally {
      close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-md p-6 bg-base-100 border border-white/10 shadow-2xl animate-fade-in-up">
        {step === 'mode' && (
          <>
            <h3 className="text-xl font-bold mb-2 text-white">Wstaw nową lekcję</h3>
            <p className="text-content-muted mb-6">
              Czy chcesz przygotować sekcję powtórki (Revision) z poprzednich zajęć?
            </p>
            <div className="flex flex-col gap-3">
              <Button variant="primary" onClick={() => setStep('confirm')} className="justify-start gap-2">
                <RefreshCw size={16} />
                Tak, sprawdź poprzednią lekcję
              </Button>
              <Button variant="secondary" onClick={insertClean} className="justify-start gap-2">
                <FileText size={16} />
                Czysta lekcja
              </Button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <h3 className="text-xl font-bold mb-2 text-white">Wstaw nową lekcję</h3>

            {recentLessons.length === 0 ? (
              <>
                <p className="text-content-muted mb-6">Brak wcześniejszych lekcji dla tego kursanta.</p>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={close}>
                    Anuluj
                  </Button>
                  <Button variant="primary" onClick={insertClean}>
                    Wstaw czystą lekcję
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-content-muted mb-4">Czy wygenerować powtórkę na podstawie tej lekcji?</p>

                <div className="rounded-xl border border-white/10 bg-base-200/50 p-4 mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-content-muted">
                    <Calendar size={13} />
                    {formatLessonDate(selectedLesson.date)}
                  </div>
                  <p className="font-bold text-white text-sm">{selectedLesson.topic || 'Bez tematu'}</p>
                  {previewLines(selectedLesson).length > 0 && (
                    <ul className="text-xs text-content-muted list-disc list-inside space-y-0.5">
                      {previewLines(selectedLesson).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {recentLessons.length > 1 && (
                  <label className="block mb-5 text-xs text-content-muted">
                    Inna lekcja:
                    <select
                      value={selectedIndex}
                      onChange={(e) => setSelectedIndex(Number(e.target.value))}
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-base-200 border border-white/10 text-sm text-white"
                    >
                      {recentLessons.map((lesson, i) => (
                        <option key={lesson.id} value={i}>
                          {formatLessonDate(lesson.date)} — {lesson.topic || 'Bez tematu'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    variant="primary"
                    onClick={generateRevision}
                    disabled={isGenerating}
                    isLoading={isGenerating}
                    className="justify-start gap-2"
                  >
                    <Sparkles size={16} />
                    Generuj powtórkę z tej lekcji
                  </Button>
                  <Button variant="ghost" onClick={insertClean} disabled={isGenerating}>
                    Wstaw bez powtórki
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default InsertLessonModal;
