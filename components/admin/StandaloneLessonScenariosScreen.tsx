import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Search, Filter, Sparkles, BookOpen, Clock, Target, 
  ChevronRight, Check, ArrowRight, Eye, User as UserIcon, 
  ArrowLeft, Plus, Play, Copy, Trash2, Tag
} from 'lucide-react';
import { GeneratedLessonScenario, User } from '../../types';
import { 
  getCuratedLessonScenarios, 
  getGeneratedScenarios, 
  deleteGeneratedScenario 
} from '../../services/scenarioService';
import { createPresentationFromScenario, savePresentationToStorage } from '../../services/presentationService';
import Button from '../ui/Button';
import Card from '../ui/Card';

interface StandaloneLessonScenariosScreenProps {
  onBack: () => void;
  onAdaptWithAI: (scenario: GeneratedLessonScenario) => void;
  onOpenInPresentation: (scenario: GeneratedLessonScenario) => void;
  selectedUser?: User | null;
}

export const StandaloneLessonScenariosScreen: React.FC<StandaloneLessonScenariosScreenProps> = ({
  onBack,
  onAdaptWithAI,
  onOpenInPresentation,
  selectedUser
}) => {
  const [activeTab, setActiveTab] = useState<'curated' | 'generated'>('curated');
  const [curatedList, setCuratedList] = useState<GeneratedLessonScenario[]>([]);
  const [generatedList, setGeneratedList] = useState<GeneratedLessonScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewingScenario, setPreviewingScenario] = useState<GeneratedLessonScenario | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [curated, generated] = await Promise.all([
        getCuratedLessonScenarios(),
        getGeneratedScenarios()
      ]);
      setCuratedList(curated);
      setGeneratedList(generated);
    } catch (e) {
      console.error('Błąd ładowania bazy scenariuszy:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentList = activeTab === 'curated' ? curatedList : generatedList;

  const categories = useMemo(() => {
    const set = new Set<string>();
    curatedList.forEach(s => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [curatedList]);

  const filteredList = useMemo(() => {
    return currentList.filter(s => {
      const matchesLevel = selectedLevel === 'all' || (s.targetLevel && s.targetLevel.includes(selectedLevel));
      const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (s.topic && s.topic.toLowerCase().includes(q)) ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(q))) ||
        (s.vocabularyText && s.vocabularyText.toLowerCase().includes(q));

      return matchesLevel && matchesCat && matchesSearch;
    });
  }, [currentList, selectedLevel, selectedCategory, searchQuery]);

  const handleCopy = (scenario: GeneratedLessonScenario, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(scenario.content);
    setCopiedId(scenario.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (scenario: GeneratedLessonScenario, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Czy na pewno chcesz usunąć scenariusz: "${scenario.topic || scenario.title}"?`)) {
      await deleteGeneratedScenario(scenario.id);
      setGeneratedList(prev => prev.filter(s => s.id !== scenario.id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in font-sans">
      {/* Top Header Card */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-r from-base-200/95 via-base-200/80 to-base-100/95 p-6 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi border border-white/10 transition-colors cursor-pointer"
              title="Wróć do panelu głównego"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/40">
                  <Layers size={22} />
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Baza Scenariuszy Lekcji
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Katalog Materiałów
                </span>
              </div>
              <p className="text-xs sm:text-sm text-content-muted mt-1 leading-relaxed">
                Gotowe wzorce dydaktyczne oraz wygenerowane konspekty. Wybierz materiał, aby użyć go bez zmian, uruchomić w Prezentacji & Notatniku lub dostosować z AI pod profil kursanta.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 pt-6 mt-6 border-t border-white/10 flex-wrap">
          <button
            onClick={() => {
              setActiveTab('curated');
              setSelectedCategory('all');
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'curated'
                ? 'bg-primary text-accent-ink shadow-[0_0_20px_rgba(114,240,180,0.3)]'
                : 'bg-base-100/60 text-content-muted hover:text-text-hi border border-white/10'
            }`}
          >
            <Sparkles size={14} />
            <span>Wzorcowe Szablony Lekcji ({curatedList.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('generated');
              setSelectedCategory('all');
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'generated'
                ? 'bg-primary text-accent-ink shadow-[0_0_20px_rgba(114,240,180,0.3)]'
                : 'bg-base-100/60 text-content-muted hover:text-text-hi border border-white/10'
            }`}
          >
            <BookOpen size={14} />
            <span>Wygenerowane i Własne ({generatedList.length})</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-base-200/60 border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po tytule, temacie, słownictwie lub tagach..."
            className="w-full bg-base-100 border border-white/15 focus:border-primary rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-content-muted outline-none"
          />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category filter */}
          {categories.length > 0 && activeTab === 'curated' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-base-100 border border-white/15 text-content text-xs font-semibold rounded-xl py-2.5 px-3 outline-none cursor-pointer"
            >
              <option value="all">Wszystkie kategorie</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Level filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-base-100 border border-white/15 text-primary text-xs font-extrabold rounded-xl py-2.5 px-3 outline-none cursor-pointer"
          >
            <option value="all">Wszystkie poziomy CEFR</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
        </div>
      </div>

      {/* Grid of Scenarios */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-6 rounded-3xl bg-base-200/40 border border-white/5 animate-pulse space-y-4">
              <div className="h-5 bg-white/10 rounded-full w-2/3"></div>
              <div className="h-3 bg-white/5 rounded-full w-1/2"></div>
              <div className="h-24 bg-white/5 rounded-2xl"></div>
            </div>
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-base-200/30 border border-white/10 space-y-3">
          <BookOpen size={36} className="mx-auto text-content-muted" />
          <h3 className="text-base font-bold text-white">Brak scenariuszy spełniających kryteria</h3>
          <p className="text-xs text-content-muted max-w-md mx-auto">
            Zmień filtry wyszukiwania lub stwórz nowy scenariusz w Planerze Lekcji.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((scenario) => {
            const stageCount = scenario.stages?.length || 0;
            const vocabCount = scenario.vocabularyText 
              ? scenario.vocabularyText.split('\n').filter(l => l.trim().length > 0).length 
              : 0;

            return (
              <div
                key={scenario.id}
                className="p-5 rounded-3xl bg-base-200/70 hover:bg-base-200/95 border border-white/10 hover:border-primary/50 transition-all flex flex-col justify-between group shadow-lg hover:shadow-[0_0_30px_rgba(114,240,180,0.15)] relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Metadata Header */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {scenario.category && (
                        <span className="px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/25">
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

                    <button
                      onClick={(e) => handleCopy(scenario, e)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-content-muted hover:text-text-hi transition-colors cursor-pointer"
                      title="Kopiuj tekst scenariusza"
                    >
                      {copiedId === scenario.id ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-white text-base group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    {scenario.topic || scenario.title}
                  </h3>

                  {/* Tags */}
                  {scenario.tags && scenario.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {scenario.tags.map((t, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded text-[9px] bg-base-300 text-content-muted">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stages count & vocab teaser */}
                  <div className="p-2.5 rounded-xl bg-base-300/50 border border-white/5 text-xs text-content-muted space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Moduły CELTA:</span>
                      <span className="text-white font-mono">{stageCount} etapów</span>
                    </div>
                    {vocabCount > 0 && (
                      <p className="line-clamp-2 font-mono text-[11px] pt-1 border-t border-white/5">
                        <span className="text-primary font-bold">Słownictwo:</span> {scenario.vocabularyText?.replace(/\n/g, ' • ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3.5 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {/* Launch in presentation */}
                    <button
                      type="button"
                      onClick={() => onOpenInPresentation(scenario)}
                      className="flex-1 py-2 px-3 rounded-xl bg-primary text-accent-ink hover:brightness-110 text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(114,240,180,0.3)] cursor-pointer"
                      title="Otwórz jako slajdy w Prezentacji & Notatniku"
                    >
                      <Play size={13} className="fill-current" />
                      <span>Prezentacja & Live</span>
                    </button>

                    {/* Adapt with AI */}
                    <button
                      type="button"
                      onClick={() => onAdaptWithAI(scenario)}
                      className="py-2 px-3 rounded-xl bg-white/5 hover:bg-primary/20 text-content-muted hover:text-primary border border-white/10 hover:border-primary/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Załaduj do Planera Lekcji i dostosuj z AI dla wybranego kursanta"
                    >
                      <Sparkles size={13} />
                      <span>Dostosuj z AI</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-content-muted pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewingScenario(scenario)}
                      className="hover:text-text-hi flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>Podgląd konspektu</span>
                    </button>

                    {activeTab === 'generated' && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(scenario, e)}
                        className="hover:text-red-400 transition-colors p-1 cursor-pointer"
                        title="Usuń ten scenariusz"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Preview Modal */}
      {previewingScenario && (
        <div 
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewingScenario(null)}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] bg-base-100 border border-primary/40 rounded-3xl p-6 overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div>
                <h2 className="text-xl font-black text-white">{previewingScenario.topic || previewingScenario.title}</h2>
                <p className="text-xs text-content-muted">
                  Poziom: {previewingScenario.targetLevel || 'B2'} • Czas: {previewingScenario.lessonDuration || '60 min'} • Kategoria: {previewingScenario.category || 'Ogólny'}
                </p>
              </div>
              <button
                onClick={() => setPreviewingScenario(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-text-hi cursor-pointer"
              >
                Zamknij
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 my-4 bg-base-200/60 rounded-2xl border border-white/5 font-mono text-sm leading-relaxed text-content">
              <div className="whitespace-pre-wrap">{previewingScenario.content}</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 shrink-0">
              <button
                onClick={() => {
                  const sc = previewingScenario;
                  setPreviewingScenario(null);
                  onAdaptWithAI(sc);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={14} className="text-primary" />
                <span>Załaduj do Planera i dostosuj z AI</span>
              </button>

              <button
                onClick={() => {
                  const sc = previewingScenario;
                  setPreviewingScenario(null);
                  onOpenInPresentation(sc);
                }}
                className="px-5 py-2.5 rounded-xl bg-primary text-accent-ink font-black text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(114,240,180,0.35)] cursor-pointer"
              >
                <Play size={14} className="fill-current" />
                <span>Uruchom w Prezentacji & Notatniku</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StandaloneLessonScenariosScreen;
