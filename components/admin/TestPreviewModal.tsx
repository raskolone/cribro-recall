import React from 'react';
import { StudentTest } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { X, CheckCircle, XCircle, Clock, User, Calendar, Award } from 'lucide-react';
import i18n from 'i18next';
import { normalizePromptLines, parseNumberedItems, parseSubAnswers } from '../../utils/testFormatters';

interface TestPreviewModalProps {
  test: StudentTest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TestPreviewModal: React.FC<TestPreviewModalProps> = ({ test, isOpen, onClose }) => {
  if (!isOpen || !test) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-base-100 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-base-200/50">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                test.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-primary/20 text-primary border border-primary/30'
              }`}>
                {test.status === 'pending' ? 'Oczekujący' : 'Ukończony / Oceniony'}
              </span>
              {test.score !== undefined && test.maxScore !== undefined && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                  <Award size={14} /> Wynik: {test.score}/{test.maxScore}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">{test.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-content-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {test.studentName && (
              <div className="p-3 bg-base-200/50 rounded-xl border border-white/5 flex items-center gap-3">
                <User className="text-primary w-5 h-5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-content-muted">{i18n.t("Kursant")}</div>
                  <div className="text-sm font-bold text-white truncate">{test.studentName}</div>
                  {test.studentEmail && <div className="text-xs text-content-muted truncate">{test.studentEmail}</div>}
                </div>
              </div>
            )}
            <div className="p-3 bg-base-200/50 rounded-xl border border-white/5 flex items-center gap-3">
              <Calendar className="text-primary w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-xs text-content-muted">{i18n.t("Termin")}</div>
                <div className="text-sm font-bold text-white">{test.dueDate}</div>
              </div>
            </div>
            <div className="p-3 bg-base-200/50 rounded-xl border border-white/5 flex items-center gap-3">
              <Clock className="text-primary w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-xs text-content-muted">{i18n.t("Podejścia")}</div>
                <div className="text-sm font-bold text-white">
                  {test.attemptsUsed || 0} / {test.attemptsLimit || 1}
                </div>
              </div>
            </div>
          </div>

          {/* Scope & Instructions */}
          {test.scope && (
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 text-sm">
              <span className="font-bold text-primary block mb-1">{i18n.t("Zakres materiału:")}</span>
              <p className="text-content-muted whitespace-pre-wrap">{test.scope}</p>
            </div>
          )}

          {test.instructions && (
            <div className="p-4 bg-base-200/40 rounded-xl border border-white/10 text-sm">
              <span className="font-bold text-white block mb-1">{i18n.t("Instrukcje:")}</span>
              <p className="text-content-muted whitespace-pre-wrap">{test.instructions}</p>
            </div>
          )}

          {/* AI Overall Feedback */}
          {test.aiFeedback && (
            <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30 text-sm">
              <span className="font-bold text-blue-400 block mb-1">{i18n.t("Informacja zwrotna z weryfikacji AI:")}</span>
              <p className="text-blue-200 whitespace-pre-wrap">{test.aiFeedback}</p>
            </div>
          )}

          {/* Questions List */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-white">{i18n.t("Pytania i odpowiedzi")} ({test.questions?.length || 0})</h3>
            
            {test.questions?.map((q, idx) => {
              const studentAns = test.studentAnswers?.[q.id];
              const isSubmitted = test.status === 'completed' || test.status === 'graded';
              const isCorrect = isSubmitted && studentAns && studentAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

              return (
                <div key={q.id || idx} className="p-4 bg-base-200/40 rounded-xl border border-white/10 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 bg-white/5 rounded text-content-muted">
                        {q.type}
                      </span>
                    </div>
                    {isSubmitted && studentAns !== undefined && (
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {isCorrect ? (
                          <span className="text-green-400 flex items-center gap-1">
                            <CheckCircle size={16} /> Poprawne
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1">
                            <XCircle size={16} /> Wymaga poprawy
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {q.instruction && (
                    <div className="text-xs text-content-muted font-medium italic">{q.instruction}</div>
                  )}

                  {(q.type === 'translation' || q.type === 'fill_in_blank') ? (
                    <div className="space-y-3">
                      {parseNumberedItems(q.prompt).map((sItem, sIdx) => {
                        const correctMap = parseSubAnswers(q.correctAnswer, 30);
                        const studentMap = studentAns ? parseSubAnswers(studentAns, 30) : {};
                        const cAns = correctMap[sIdx] || '';
                        const sAns = studentMap[sIdx] || '';

                        return (
                          <div key={sIdx} className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 select-none">
                                {sItem.num}
                              </span>
                              <p className="text-sm md:text-base font-semibold text-white leading-relaxed select-none">
                                {sItem.text}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                              <div className="p-2 rounded-lg bg-base-100/80 border border-white/5">
                                <span className="text-[10px] text-content-muted uppercase tracking-wider block font-bold mb-0.5">Prawidłowa odpowiedź {sItem.num}:</span>
                                <span className="font-bold text-primary">{cAns || normalizePromptLines(q.correctAnswer)}</span>
                              </div>
                              {isSubmitted && (
                                <div className={`p-2 rounded-lg border ${
                                  sAns.toLowerCase() === cAns.toLowerCase()
                                    ? 'bg-green-500/10 border-green-500/20 text-green-300'
                                    : 'bg-red-500/10 border-red-500/20 text-red-300'
                                }`}>
                                  <span className="text-[10px] opacity-80 uppercase tracking-wider block font-bold mb-0.5">Odpowiedź kursanta {sItem.num}:</span>
                                  <span className="font-bold">{sAns || 'Brak odpowiedzi'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <div className="text-base font-medium text-white whitespace-pre-wrap leading-relaxed">
                        {normalizePromptLines(q.prompt)}
                      </div>

                      {/* Options if available */}
                      {q.options && q.options.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {q.options.map((opt, oIdx) => (
                            <span key={oIdx} className="px-2.5 py-1 bg-white/5 rounded-lg text-xs text-content-muted border border-white/5">
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Word bank if available */}
                      {q.wordBank && q.wordBank.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-xs text-content-muted mr-1">Bank słów:</span>
                          {q.wordBank.map((wb, wIdx) => (
                            <span key={wIdx} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                              {wb}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="p-2.5 rounded-lg bg-base-100 border border-white/5">
                          <span className="text-xs text-content-muted block">{i18n.t("Prawidłowa odpowiedź:")}</span>
                          <span className="font-bold text-primary whitespace-pre-wrap block leading-relaxed">{normalizePromptLines(q.correctAnswer)}</span>
                        </div>

                        {isSubmitted && (
                          <div className={`p-2.5 rounded-lg border ${
                            isCorrect ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
                          }`}>
                            <span className="text-xs opacity-75 block">{i18n.t("Odpowiedź kursanta:")}</span>
                            <span className="font-bold whitespace-pre-wrap block leading-relaxed">{studentAns ? normalizePromptLines(studentAns) : i18n.t("Brak odpowiedzi")}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-base-200/50 flex justify-end">
          <Button onClick={onClose} variant="secondary">{i18n.t("Zamknij")}</Button>
        </div>
      </div>
    </div>
  );
};

export default TestPreviewModal;
