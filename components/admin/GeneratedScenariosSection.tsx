import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, Layers, Search, Filter, Trash2, Copy, Check, 
  Eye, Plus, Calendar, Clock, User as UserIcon, BookOpen, 
  ArrowRight, RefreshCw, FileText, CheckCircle2, ChevronRight
} from 'lucide-react';
import { GeneratedLessonScenario, User } from '../../types';
import { getGeneratedScenarios, deleteGeneratedScenario } from '../../services/scenarioService';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { ScenarioPreviewModal } from './ScenarioPreviewModal';

interface GeneratedScenariosSectionProps {
  selectedUser?: User | null;
  onInsertToLessonRecord?: (data: { 
    topic: string; 
    summary: string; 
    vocabulary: string; 
    followUp: string;
    scenarioId?: string;
    scenarioTopic?: string;
    scenarioContent?: string;
  }) => void;
  onSelectTopicPrompt?: (prompt: string) => void;
  lastUpdatedTimestamp?: number;
}

export const GeneratedScenariosSection: React.FC<GeneratedScenariosSectionProps> = ({
  selectedUser,
  onInsertToLessonRecord,
  onSelectTopicPrompt,
  lastUpdatedTimestamp
}) => {
  const [scenarios, setScenarios] = useState<GeneratedLessonScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStudent, setFilterStudent] = useState<'all' | 'current'>('all');
  const [previewingScenario, setPreviewingScenario] = useState<GeneratedLessonScenario | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchScenarios = async () => {
    setIsLoading(true);
    try {
      const list = await getGeneratedScenarios();
      setScenarios(list);
    } catch (e) {
      console.error('Error fetching scenarios:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, [lastUpdatedTimestamp]);

  const handleDelete = async (scenario: GeneratedLessonScenario, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Czy na pewno chcesz usunąć scenariusz: "${scenario.topic || scenario.title}"?`)) {
      try {
        await deleteGeneratedScenario(scenario.id);
        setScenarios(prev => prev.filter(s => s.id !== scenario.id));
      } catch (err) {
        console.error('Failed to delete scenario:', err);
      }
    }
  };

  const handleCopy = (scenario: GeneratedLessonScenario, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(scenario.content);
    setCopiedId(scenario.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredScenarios = useMemo(() => {
    let list = [...scenarios];

    if (filterStudent === 'current' && selectedUser?.id) {
      list = list.filter(s => s.studentId === selectedUser.id);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => 
        (s.topic && s.topic.toLowerCase().includes(q)) ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.vocabularyText && s.vocabularyText.toLowerCase().includes(q)) ||
        (s.content && s.content.toLowerCase().includes(q))
      );
    }

    return list;
  }, [scenarios, filterStudent, selectedUser?.id, searchQuery]);

  return (
    <div className="border-t border-white/10 pt-10 mt-12 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Layers size={18} />
            </div>
            <h3 className="text-xl font-black text-white font-display flex items-center gap-2.5">
              <span>Wygenerowane scenariusze</span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {scenarios.length}
              </span>
            </h3>
          </div>
          <p className="text-xs text-content-muted mt-1.5 leading-relaxed">
            Baza wszystkich przygotowanych konspektów lekcji z podziałem na etapy i słownictwo. Możesz je przeglądać, kopiować i podpinać do historii lekcji kursanta.
          </p>
        </div>

        {/* Filter & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedUser && (
            <div className="flex items-center p-1 bg-base-200/80 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setFilterStudent('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterStudent === 'all'
                    ? 'bg-primary text-accent-ink shadow-sm'
                    : 'text-content-muted hover:text-white'
                }`}
              >
                Wszystkie ({scenarios.length})
              </button>
              <button
                onClick={() => setFilterStudent('current')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterStudent === 'current'
                    ? 'bg-primary text-accent-ink shadow-sm'
                    : 'text-content-muted hover:text-white'
                }`}
              >
                Dla {selectedUser.firstName || selectedUser.username}
              </button>
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchScenarios}
            className="text-xs text-content-muted hover:text-white"
            title="Odśwież listę scenariuszy"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Search Input */}
      {scenarios.length > 0 && (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Szukaj scenariusza po temacie, słownictwie lub kursancie..."
            className="w-full bg-base-200/60 border border-white/10 hover:border-white/20 focus:border-primary/50 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-content-muted transition-all outline-none"
          />
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-content-muted hover:text-white"
            >
              Wyczyść
            </button>
          )}
        </div>
      )}

      {/* Scenarios Grid / List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="p-5 rounded-3xl bg-base-200/40 border border-white/5 animate-pulse space-y-3">
              <div className="h-4 bg-white/10 rounded-full w-2/3"></div>
              <div className="h-3 bg-white/5 rounded-full w-1/2"></div>
              <div className="h-16 bg-white/5 rounded-2xl"></div>
            </div>
          ))}
        </div>
      ) : filteredScenarios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredScenarios.map(scenario => {
            const stageCount = scenario.stages?.length || 0;
            const vocabCount = scenario.vocabularyText
              ? scenario.vocabularyText.split('\n').filter(l => l.trim().length > 0).length
              : 0;

            return (
              <div
                key={scenario.id}
                onClick={() => setPreviewingScenario(scenario)}
                className="p-5 rounded-3xl bg-base-200/50 hover:bg-base-200/80 border border-white/10 hover:border-primary/40 transition-all group flex flex-col justify-between cursor-pointer hover:shadow-[0_0_25px_rgba(114,240,180,0.15)] relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Top Metadata Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {scenario.studentName ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                          <UserIcon size={11} /> {scenario.studentName}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-content-muted border border-white/5">
                          Ogólny
                        </span>
                      )}
                      {scenario.targetLevel && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/5 text-content-muted border border-white/5">
                          {scenario.targetLevel}
                        </span>
                      )}
                      {scenario.lessonDuration && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-content-muted border border-white/5">
                          {scenario.lessonDuration}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-content-muted">
                      {new Date(scenario.createdAt).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Scenario Title */}
                  <div>
                    <h4 className="text-base font-black text-white group-hover:text-primary transition-colors line-clamp-1 font-display">
                      {scenario.topic || scenario.title}
                    </h4>
                  </div>

                  {/* Stage Chips & Teaser */}
                  <div className="space-y-2">
                    {stageCount > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {scenario.stages?.slice(0, 4).map((stg, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded-lg text-[10px] bg-base-300/80 text-content-muted border border-white/5 truncate max-w-[140px]"
                          >
                            {stg.title.replace(/^\d+\.\s*/, '')}
                          </span>
                        ))}
                        {stageCount > 4 && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] bg-base-300/80 text-primary font-bold border border-white/5">
                            +{stageCount - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Vocabulary Teaser */}
                    {scenario.vocabularyText && (
                      <div className="p-2.5 rounded-xl bg-base-300/40 border border-white/5 text-xs text-content-muted line-clamp-2 font-mono">
                        <span className="text-primary font-bold mr-1.5">Słownictwo ({vocabCount}):</span>
                        {scenario.vocabularyText.replace(/\n/g, ' • ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between gap-2">
                  <span className="text-xs text-primary font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <Eye size={13} /> Podgląd etapów
                  </span>

                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    {onInsertToLessonRecord && (
                      <button
                        onClick={() => {
                          onInsertToLessonRecord({
                            topic: scenario.topic || scenario.title,
                            summary: scenario.stages?.find(s => s.title.toLowerCase().includes('main topic') || s.title.toLowerCase().includes('warm up'))?.body || '',
                            vocabulary: scenario.vocabularyText || '',
                            followUp: scenario.stages?.find(s => s.title.toLowerCase().includes('homework'))?.body || '',
                            scenarioId: scenario.id,
                            scenarioTopic: scenario.topic || scenario.title,
                            scenarioContent: scenario.content
                          });
                        }}
                        className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 transition-all text-xs font-bold flex items-center gap-1"
                        title="Przypisz do wpisu historii lekcji"
                      >
                        <Plus size={13} /> <span className="hidden sm:inline">Przypisz do lekcji</span>
                      </button>
                    )}
                    <button
                      onClick={e => handleCopy(scenario, e)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white transition-colors"
                      title="Kopiuj treść scenariusza"
                    >
                      {copiedId === scenario.id ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={e => handleDelete(scenario, e)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-danger/15 text-content-muted hover:text-danger transition-colors"
                      title="Usuń scenariusz"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center bg-base-200/30 rounded-3xl border border-white/5 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-content-muted">
            <BookOpen size={24} />
          </div>
          <h4 className="font-bold text-white text-base">Brak wygenerowanych scenariuszy</h4>
          <p className="text-xs text-content-muted max-w-md mx-auto leading-relaxed">
            Gdy wygenerujesz scenariusz lekcji w oknie czatu powyżej, zostanie on automatycznie zapisany w tej sekcji.
          </p>
        </div>
      )}

      {/* Scenario Full Preview Modal */}
      <ScenarioPreviewModal
        scenario={previewingScenario}
        isOpen={Boolean(previewingScenario)}
        onClose={() => setPreviewingScenario(null)}
        onInsertToLessonRecord={onInsertToLessonRecord}
      />
    </div>
  );
};
