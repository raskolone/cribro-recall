import React, { useState } from 'react';
import { LessonRecord } from '../../types';
import { X, BookOpen, Check, Search, Calendar, FileText, Sparkles, Filter, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';

interface LessonSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessons: LessonRecord[];
  isLoading?: boolean;
  selectedLessonIds: string[];
  onSave: (selectedIds: string[]) => void;
  studentName?: string;
}

export const LessonSelectionModal: React.FC<LessonSelectionModalProps> = ({
  isOpen,
  onClose,
  lessons,
  isLoading = false,
  selectedLessonIds,
  onSave,
  studentName,
}) => {
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(selectedLessonIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  // Sync temp state whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTempSelectedIds(selectedLessonIds);
      setSearchTerm('');
    }
  }, [isOpen, selectedLessonIds]);

  if (!isOpen) return null;

  const toggleLesson = (id: string) => {
    setTempSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((lId) => lId !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (tempSelectedIds.length === lessons.length) {
      setTempSelectedIds([]);
    } else {
      setTempSelectedIds(lessons.map((l) => l.id));
    }
  };

  const selectLastN = (n: number) => {
    setTempSelectedIds(lessons.slice(0, n).map((l) => l.id));
  };

  const clearAll = () => {
    setTempSelectedIds([]);
  };

  const handleApply = () => {
    onSave(tempSelectedIds);
    onClose();
  };

  const filteredLessons = lessons.filter((l) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (l.topic && l.topic.toLowerCase().includes(term)) ||
      (l.date && l.date.toLowerCase().includes(term)) ||
      (l.vocabularyText && l.vocabularyText.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121926] border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-base-200/50 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Wybór lekcji do analizy AI
                {studentName && <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">Kursant: {studentName}</span>}
              </h2>
              <p className="text-xs text-content-muted mt-0.5">
                Wskazane lekcje przekażą AI dane z Revision Notes, Student Transcript i Things to Improve.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Top Info Notice */}
          <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl text-xs text-gray-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-primary mb-0.5">Generowanie bezwyborowe lub z historią lekcji:</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Jeśli nie zaznaczysz żadnej lekcji, zadania zostaną wygenerowane wyłącznie na podstawie Twoich wytycznych/promptu lub wpisanych zdań manualnych.
              </p>
            </div>
          </div>

          {/* Controls & Quick Selects */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Szukaj po temacie lub słownictwie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-base-100 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 text-xs font-medium bg-base-100 hover:bg-white/10 text-primary border border-primary/30 rounded-lg transition-all"
                >
                  {tempSelectedIds.length === lessons.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                </button>
                {lessons.length > 2 && (
                  <button
                    type="button"
                    onClick={() => selectLastN(2)}
                    className="px-2.5 py-1 text-xs font-medium bg-base-100 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all"
                  >
                    Ostatnie 2
                  </button>
                )}
                {lessons.length > 4 && (
                  <button
                    type="button"
                    onClick={() => selectLastN(4)}
                    className="px-2.5 py-1 text-xs font-medium bg-base-100 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all"
                  >
                    Ostatnie 4
                  </button>
                )}
                {tempSelectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-2.5 py-1 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all"
                  >
                    Wyczyść
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lessons List */}
          {isLoading ? (
            <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span>Ładowanie historii lekcji kursanta...</span>
            </div>
          ) : lessons.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-white/10 rounded-xl p-4">
              Brak historii lekcji zapisanych dla tego kursanta. Możesz wpisać temat i wytyczne manualnie.
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              Brak lekcji pasujących do wyszukiwania "{searchTerm}".
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredLessons.map((record, index) => {
                const isSelected = tempSelectedIds.includes(record.id);
                const isExpanded = expandedLessonId === record.id;
                const vocabCount = record.vocabularyText ? record.vocabularyText.split('\n').filter(Boolean).length : 0;

                return (
                  <div
                    key={record.id}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? 'bg-primary/10 border-primary/40 shadow-[0_0_15px_rgba(114,240,180,0.08)]'
                        : 'bg-base-100/60 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div
                      onClick={() => toggleLesson(record.id)}
                      className="p-3 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-primary text-black font-bold scale-105'
                              : 'border border-white/30 hover:border-white/60'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">
                              Lekcja #{lessons.length - index}: {record.topic || 'Bez tematu'}
                            </span>
                            {record.date && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md">
                                <Calendar className="w-3 h-3 text-primary/70" />
                                {record.date}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                            {vocabCount > 0 && <span>słówek: <strong className="text-primary">{vocabCount}</strong></span>}
                            {record.thingsToImprove && <span className="text-amber-400/90 font-medium">• Uwagi do poprawy</span>}
                            {record.studentSpeaking && <span className="text-emerald-400/90 font-medium">• Transcript wypowiedzi</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedLessonId(isExpanded ? null : record.id);
                        }}
                        className="px-2 py-1 text-[11px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg shrink-0 transition-all"
                      >
                        {isExpanded ? 'Ukryj podgląd' : 'Podgląd'}
                      </button>
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && (
                      <div className="p-3 border-t border-white/10 bg-black/20 text-xs space-y-2.5 animate-fadeIn">
                        {record.vocabularyText && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-primary font-bold block mb-1">
                              Revision Notes / Słownictwo:
                            </span>
                            <pre className="whitespace-pre-wrap font-sans text-gray-300 text-[11px] bg-base-100 p-2 rounded-lg border border-white/5 max-h-24 overflow-y-auto">
                              {record.vocabularyText}
                            </pre>
                          </div>
                        )}

                        {record.thingsToImprove && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block mb-1">
                              Things to improve:
                            </span>
                            <pre className="whitespace-pre-wrap font-sans text-gray-300 text-[11px] bg-base-100 p-2 rounded-lg border border-white/5 max-h-24 overflow-y-auto">
                              {record.thingsToImprove}
                            </pre>
                          </div>
                        )}

                        {record.studentSpeaking && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block mb-1">
                              Student Transcript / Spoken content:
                            </span>
                            <pre className="whitespace-pre-wrap font-sans text-gray-300 text-[11px] bg-base-100 p-2 rounded-lg border border-white/5 max-h-24 overflow-y-auto">
                              {record.studentSpeaking}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-base-200/50 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-300">
            Wybrano: <strong className="text-primary font-bold">{tempSelectedIds.length}</strong> z {lessons.length} lekcji
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
            >
              Anuluj
            </button>
            <Button
              onClick={handleApply}
              variant="primary"
              className="px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-primary/10"
            >
              <Check className="w-4 h-4" />
              <span>Zatwierdź wybór ({tempSelectedIds.length})</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
