import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SpecialTask } from '../../types';
import { formatHomeworkStatus, HomeworkLanguage } from '../../utils/homeworkStatus';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import HomeworkV2ReviewScreen from '../admin/HomeworkV2ReviewScreen';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Check, Sparkles, X } from 'lucide-react';

export interface TeacherReviewModalProps {
  task: SpecialTask | null;
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
  isV2?: boolean;
  language?: HomeworkLanguage;
  formatDate?: (value?: string) => string;
  teacherFeedbackText?: string;
  onFeedbackChange?: (text: string) => void;
  onAnalyzeWithAI?: () => void;
  isAnalyzing?: boolean;
  onSaveReview?: () => void;
  isSavingReview?: boolean;
  renderExercisePrompt?: (item: any, itemType: string) => React.ReactNode;
  renderStudentAnswerDisplay?: (answer: any, item: any) => React.ReactNode;
  homeworkItemType?: (item: any, task: SpecialTask) => string;
}

export const TeacherReviewModal: React.FC<TeacherReviewModalProps> = ({
  task,
  isOpen,
  onClose,
  studentName = 'Kursant',
  isV2 = false,
  language = 'pl',
  formatDate,
  teacherFeedbackText = '',
  onFeedbackChange,
  onAnalyzeWithAI,
  isAnalyzing = false,
  onSaveReview,
  isSavingReview = false,
  renderExercisePrompt,
  renderStudentAnswerDisplay,
  homeworkItemType,
}) => {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Rejestracja globalnego ESC przez hook używany w całej aplikacji
  useEscapeModal(isOpen, onClose, 20);

  // Blokada przewijania <body> na czas otwarcia z bezpiecznym przywróceniem poprzedniego stanu
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Zarządzanie fokusem: zapamiętanie elementu otwierającego, przeniesienie fokusu do modalu,
  // oraz przywrócenie fokusu przy zamknięciu bez resetowania scrolla (preventScroll: true)
  useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== 'undefined') {
      openerRef.current = document.activeElement as HTMLElement | null;
    }

    const timer = setTimeout(() => {
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, 30);

    return () => {
      clearTimeout(timer);
      try {
        openerRef.current?.focus?.({ preventScroll: true });
      } catch {
        // Ignoruj błędy jeśli element otwierający został odmontowany
      }
    };
  }, [isOpen]);

  // Focus trap wewnątrz modalu
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'Tab' && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
  };

  if (!isOpen || !task) return null;
  if (typeof document === 'undefined') return null;

  const sentencesCount = task.sentences?.length || 0;
  const statusLabel = formatHomeworkStatus(task.status, language);
  const statusBadgeVariant = task.status === 'submitted' || task.status === 'graded' ? 'ok' : 'wait';

  const modalContent = (
    <div
      className="fixed inset-0 z-[60] bg-ink/75 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden"
      onMouseDown={(e) => {
        // Kliknięcie w tło zamyka modal
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      data-testid="teacher-review-overlay"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="teacher-review-dialog"
        className="w-full sm:max-w-5xl sm:w-[90vw] h-[100dvh] sm:h-[92dvh] sm:max-h-[92dvh] sm:rounded-2xl liquid-glass-panel border border-white/10 sm:border-primary/30 flex flex-col overflow-hidden bg-base-100 shadow-2xl text-text"
      >
        {/* ── 1. STAŁY NAGŁÓWEK ── */}
        <header className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 bg-base-100/95 backdrop-blur-md flex items-start justify-between gap-4 z-10">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                Przegląd & Ocena nauczyciela
              </span>
              {statusLabel && (
                <Badge status={statusBadgeVariant}>
                  {statusLabel}
                </Badge>
              )}
            </div>

            <h2 id={titleId} className="text-lg sm:text-xl font-bold text-text-hi leading-snug truncate">
              {task.title || (language === 'pl' ? 'Praca domowa' : 'Homework')}
            </h2>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted mt-1.5">
              <span>
                Kursant: <strong className="text-text-hi">{studentName}</strong>
              </span>
              {task.createdAt && formatDate && (
                <span className="hidden sm:inline">
                  • Zadano: <strong className="text-content">{formatDate(task.createdAt)}</strong>
                </span>
              )}
              {task.submittedAt && formatDate && (
                <span className="text-primary font-medium">
                  • Nadesłano: <strong>{formatDate(task.submittedAt)}</strong>
                </span>
              )}
              {task.dueDate && (
                <span>
                  • Termin: <strong className="text-content">{task.dueDate}</strong>
                </span>
              )}
              <span>
                • Liczba zadań: <strong className="text-content">{sentencesCount}</strong>
              </span>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={language === 'pl' ? 'Zamknij' : 'Close'}
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            data-testid="teacher-review-close-btn"
          >
            <X size={20} />
          </button>
        </header>

        {/* ── 2. PRZEWIJANA ŚRODKOWA CZĘŚĆ (JEDYNY ELEMENT ZE SCROLLEM) ── */}
        <main
          className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 space-y-4 pr-2 sm:pr-4"
          data-testid="teacher-review-scroll-container"
        >
          {isV2 ? (
            <HomeworkV2ReviewScreen task={task} />
          ) : (
            <>
              {/* Karty poszczególnych zadań */}
              <div className="space-y-4">
                {task.sentences?.map((item: any, idx: number) => {
                  const stAns = task.studentAnswers ? (task.studentAnswers as any)[idx] : '';
                  const evalItem = task.evaluationResults ? task.evaluationResults[idx] : null;
                  const itemType = homeworkItemType ? homeworkItemType(item, task) : item.type || 'translation';

                  return (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 rounded-xl bg-base-200/60 border border-white/5 space-y-3 shadow-sm"
                    >
                      <div className="flex justify-between items-center text-xs font-mono text-content-muted">
                        <span className="font-bold text-primary">Zadanie #{idx + 1}</span>
                        {evalItem?.score !== undefined && (
                          <span className="text-primary font-bold px-2 py-0.5 rounded-full bg-primary/10">
                            Wynik AI: {Number.isNaN(Number(evalItem.score)) ? 0 : evalItem.score}%
                          </span>
                        )}
                      </div>

                      {/* Polecenie zadania */}
                      <div className="space-y-1">
                        {renderExercisePrompt ? (
                          renderExercisePrompt(item, itemType)
                        ) : (
                          <p className="text-sm font-medium text-text-hi">
                            {item.polishSentence || item.sentence || item.question || item.prompt}
                          </p>
                        )}
                      </div>

                      {/* Wskazówka lektora / generatora (jeśli występuje) */}
                      {item.hint && (
                        <div className="text-xs text-text-2 bg-base-100/60 p-2.5 rounded-lg border border-white/5 flex items-start gap-1.5">
                          <span className="text-warn">💡</span>
                          <span>Wskazówka: {item.hint}</span>
                        </div>
                      )}

                      {/* Wzorzec / poprawna odpowiedź (jeśli występuje) */}
                      {(item.correctSentence || item.solution || item.correctTranslation) && (
                        <div className="p-2.5 rounded-lg bg-base-100/70 border border-white/5 text-xs text-content-muted">
                          <span className="font-semibold block mb-0.5 text-text-hi">
                            Wzorzec / Poprawna odpowiedź:
                          </span>
                          <span className="text-primary font-medium">
                            {item.correctSentence || item.solution || item.correctTranslation}
                          </span>
                        </div>
                      )}

                      {/* Odpowiedź kursanta */}
                      <div className="p-3 rounded-lg bg-base-100 border border-white/10 text-sm">
                        <span className="text-xs font-semibold text-content-muted block mb-1">
                          Odpowiedź kursanta:
                        </span>
                        {renderStudentAnswerDisplay ? (
                          renderStudentAnswerDisplay(stAns, item)
                        ) : (
                          <span className="text-text-hi break-words font-medium">
                            {typeof stAns === 'string'
                              ? stAns || <span className="text-content-muted italic">(brak odpowiedzi)</span>
                              : JSON.stringify(stAns)}
                          </span>
                        )}
                      </div>

                      {/* Wyjaśnienie AI */}
                      {evalItem?.explanation && (
                        <p className="text-xs text-content-muted italic bg-base-300/40 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                          💡 {evalItem.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sekcja komentarza lektora */}
              <div className="pt-4 border-t border-white/10 space-y-2.5">
                <label htmlFor="teacher-feedback-textarea" className="block text-sm font-bold text-text-hi">
                  Komentarz / Wskazówki nauczyciela dla kursanta:
                </label>
                <textarea
                  id="teacher-feedback-textarea"
                  rows={3}
                  value={teacherFeedbackText}
                  onChange={(e) => onFeedbackChange?.(e.target.value)}
                  placeholder="Wpisz słowa uznania, uwagi do gramatyki lub zalecenia do powtórki..."
                  className="w-full px-4 py-3 bg-base-100 text-text-hi border border-white/10 rounded-xl focus:border-primary focus:outline-none text-sm resize-y shadow-inner"
                />
              </div>
            </>
          )}
        </main>

        {/* ── 3. STAŁA STOPKA Z AKCJAMI (ZAWSZE WIDOCZNA) ── */}
        <footer
          className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4 bg-base-100/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 z-10"
          data-testid="teacher-review-footer"
        >
          {isV2 ? (
            <div className="w-full flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                data-testid="teacher-review-close-footer-btn"
              >
                Zamknij
              </Button>
            </div>
          ) : (
            <>
              <div>
                {onAnalyzeWithAI && (
                  <Button
                    type="button"
                    onClick={onAnalyzeWithAI}
                    isLoading={isAnalyzing}
                    className="flex items-center gap-2"
                    data-testid="teacher-review-ai-btn"
                  >
                    <Sparkles size={18} /> Zaproponuj ocenę z AI
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  data-testid="teacher-review-close-footer-btn"
                >
                  Zamknij
                </Button>
                {onSaveReview && (
                  <Button
                    type="button"
                    onClick={onSaveReview}
                    isLoading={isSavingReview}
                    className="flex items-center gap-2"
                    data-testid="teacher-review-save-btn"
                  >
                    <Check size={18} /> Zatwierdź i wyślij do kursanta
                  </Button>
                )}
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default TeacherReviewModal;
