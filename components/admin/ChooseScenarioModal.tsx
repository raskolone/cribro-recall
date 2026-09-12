import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Layers, Search, Sparkles, BookOpen, Clock, Target, 
  ChevronRight, Check, ArrowRight, Eye, User as UserIcon
} from 'lucide-react';
import { GeneratedLessonScenario, User } from '../../types';
import { getCuratedLessonScenarios, getGeneratedScenarios } from '../../services/scenarioService';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface ChooseScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUser?: User | null;
  onSelectScenarioForAdaptation: (scenario: GeneratedLessonScenario) => void;
  onSelectScenarioDirectUse: (scenario: GeneratedLessonScenario) => void;
}

export const ChooseScenarioModal: React.FC<ChooseScenarioModalProps> = ({
  isOpen,
  onClose,
  selectedUser,
  onSelectScenarioForAdaptation,
  onSelectScenarioDirectUse
}) => {
  useEscapeModal(isOpen, onClose);

  const [activeTab, setActiveTab] = useState<'curated' | 'generated'>('curated');
  const [curatedList, setCuratedList] = useState<GeneratedLessonScenario[]>([]);
  const [generatedList, setGeneratedList] = useState<GeneratedLessonScenario[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [previewingScenario, setPreviewingScenario] = useState<GeneratedLessonScenario | null>(null);

  useEffect(() => {
    if (isOpen) {
      getCuratedLessonScenarios().then(setCuratedList);
      getGeneratedScenarios().then(setGeneratedList);
    }
  }, [isOpen]);

  const currentList = activeTab === 'curated' ? curatedList : generatedList;

  const filteredList = useMemo(() => {
    return currentList.filter(s => {
      const matchesLevel = selectedLevel === 'all' || (s.targetLevel && s.targetLevel.includes(selectedLevel));
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (s.topic && s.topic.toLowerCase().includes(q)) ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(q))) ||
        (s.vocabularyText && s.vocabularyText.toLowerCase().includes(q));

      return matchesLevel && matchesSearch;
    });
  }, [currentList, selectedLevel, searchQuery]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-base-100 border border-primary/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between bg-base-200/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/20 text-primary border border-primary/30">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
                Baza Gotowych Scenariuszy Lekcji
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/20 text-primary border border-primary/30">
                  {currentList.length} materiałów
                </span>
              </h3>
              <p className="text-xs text-content-muted">
                Wybierz gotowy konspekt, aby użyć go bez zmian lub dostosować z AI dla kursanta
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi transition-colors cursor-pointer border border-white/10"
            title="Zamknij okno (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs & Search Filter Bar */}
        <div className="p-4 sm:p-5 bg-base-200/40 border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-base-300/80 rounded-2xl border border-white/10 self-start">
            <button
              onClick={() => setActiveTab('curated')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'curated'
                  ? 'bg-primary text-accent-ink shadow-md'
                  : 'text-content-muted hover:text-text-hi'
              }`}
            >
              Wzorcowe szablony ({curatedList.length})
            </button>
            <button
              onClick={() => setActiveTab('generated')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'generated'
                  ? 'bg-primary text-accent-ink shadow-md'
                  : 'text-content-muted hover:text-text-hi'
              }`}
            >
              Dotychczas wygenerowane ({generatedList.length})
            </button>
          </div>

          {/* Search and Level Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj tematu, kategorii, słówek..."
                className="w-full bg-base-100/90 border border-white/15 focus:border-primary rounded-xl py-2 pl-8 pr-3 text-xs text-white placeholder-content-muted outline-none"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
            </div>

            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="bg-base-100/90 border border-white/15 text-primary text-xs font-extrabold rounded-xl py-2 px-3 outline-none cursor-pointer"
            >
              <option value="all">Wszystkie poziomy</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
          </div>
        </div>

        {/* Content: List / Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5">
          {filteredList.length === 0 ? (
            <div className="p-10 text-center text-content-muted space-y-2">
              <BookOpen size={32} className="mx-auto text-content-muted/60" />
              <p className="text-sm font-bold text-white">Brak scenariuszy spełniających kryteria</p>
              <p className="text-xs">Zmień wyszukiwaną frazę lub filtr poziomu</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredList.map((scenario) => {
                const stageCount = scenario.stages?.length || 0;
                const vocabCount = scenario.vocabularyText 
                  ? scenario.vocabularyText.split('\n').filter(l => l.trim().length > 0).length 
                  : 0;

                return (
                  <div
                    key={scenario.id}
                    className="p-4 sm:p-5 rounded-2xl bg-base-200/60 border border-white/10 hover:border-primary/50 transition-all flex flex-col justify-between group relative shadow-md hover:shadow-[0_0_25px_rgba(114,240,180,0.15)]"
                  >
                    <div className="space-y-2.5">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {scenario.category && (
                            <span className="px-2 py-0.5 rounded-md font-bold bg-primary/10 text-primary border border-primary/20">
                              {scenario.category}
                            </span>
                          )}
                          {scenario.targetLevel && (
                            <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-white/5 text-content-muted border border-white/10">
                              {scenario.targetLevel}
                            </span>
                          )}
                          {scenario.lessonDuration && (
                            <span className="px-2 py-0.5 rounded-md font-medium bg-white/5 text-content-muted border border-white/10 flex items-center gap-1">
                              <Clock size={10} /> {scenario.lessonDuration}
                            </span>
                          )}
                        </div>

                        {scenario.studentName && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 text-content-muted flex items-center gap-1 truncate max-w-[130px]">
                            <UserIcon size={10} /> {scenario.studentName}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="font-extrabold text-white text-base group-hover:text-primary transition-colors line-clamp-1">
                        {scenario.topic || scenario.title}
                      </h4>

                      {/* Tags / Teaser */}
                      {scenario.tags && scenario.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {scenario.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="px-1.5 py-0.5 rounded text-[9px] bg-base-300 text-content-muted">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Vocab snippet */}
                      {vocabCount > 0 && (
                        <p className="text-[11px] text-content-muted line-clamp-2 font-mono bg-base-300/60 p-2 rounded-xl border border-white/5">
                          <span className="text-primary font-bold">Słownictwo ({vocabCount}):</span> {scenario.vocabularyText?.replace(/\n/g, ' • ')}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewingScenario(scenario)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Zobacz pełną treść i moduły"
                      >
                        <Eye size={13} />
                        <span>Podgląd</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectScenarioDirectUse(scenario);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Użyj tego scenariusza bez zmian z modelem AI"
                        >
                          <Check size={13} className="text-primary" />
                          <span>Użyj bez zmian</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectScenarioForAdaptation(scenario);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-primary text-accent-ink hover:brightness-110 text-xs font-black transition-all flex items-center gap-1 shadow-[0_0_12px_rgba(114,240,180,0.3)] cursor-pointer"
                          title="Wypełnij planer tym scenariuszem i dostosuj go z AI pod kursanta"
                        >
                          <Sparkles size={13} />
                          <span>Dostosuj z AI</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-base-200/50 flex items-center justify-between text-xs text-content-muted shrink-0">
          <span>
            {selectedUser 
              ? `Wybrany kursant do adaptacji: ${selectedUser.firstName || selectedUser.username} (${selectedUser.level || 'B2'})`
              : 'Tryb ogólny (brak wybranego kursanta)'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-content-muted hover:text-text-hi font-semibold cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>

      {/* Embedded Full Preview Modal */}
      {previewingScenario && (
        <div 
          className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewingScenario(null)}
        >
          <div 
            className="w-full max-w-3xl max-h-[88vh] bg-base-100 border border-primary/40 rounded-3xl p-6 overflow-y-auto shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white">{previewingScenario.topic || previewingScenario.title}</h3>
              <button 
                onClick={() => setPreviewingScenario(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="whitespace-pre-wrap text-sm text-content-muted font-mono leading-relaxed bg-base-200/60 p-4 rounded-2xl border border-white/5 max-h-[60vh] overflow-y-auto">
              {previewingScenario.content}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const sc = previewingScenario;
                  setPreviewingScenario(null);
                  onSelectScenarioDirectUse(sc);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Użyj bez zmian
              </button>
              <button
                type="button"
                onClick={() => {
                  const sc = previewingScenario;
                  setPreviewingScenario(null);
                  onSelectScenarioForAdaptation(sc);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-primary text-accent-ink font-black text-xs shadow-[0_0_15px_rgba(114,240,180,0.35)] cursor-pointer"
              >
                Załaduj do adaptacji z AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChooseScenarioModal;
