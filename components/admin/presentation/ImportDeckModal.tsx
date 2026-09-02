import React, { useState, useEffect } from 'react';
import { 
  X, Layers, BookOpen, Clock, ChevronRight, Search, 
  Sparkles, CheckCircle2, ArrowRight, FileText
} from 'lucide-react';
import { GeneratedLessonScenario, LessonRecord, LessonPresentation } from '../../../types';
import { getGeneratedScenarios } from '../../../services/scenarioService';
import { 
  createPresentationFromScenario, 
  createPresentationFromLessonRecord 
} from '../../../services/presentationService';
import Button from '../../ui/Button';

interface ImportDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (deck: LessonPresentation) => void;
  lessonRecords?: LessonRecord[];
  studentId?: string | null;
  studentName?: string | null;
}

export const ImportDeckModal: React.FC<ImportDeckModalProps> = ({
  isOpen,
  onClose,
  onImport,
  lessonRecords = [],
  studentId,
  studentName
}) => {
  if (!isOpen) return null;

  const [tab, setTab] = useState<'scenarios' | 'records'>('scenarios');
  const [scenarios, setScenarios] = useState<GeneratedLessonScenario[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGeneratedScenarios()
      .then(data => {
        setScenarios(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredScenarios = scenarios.filter(s => 
    (s.topic || s.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.studentName || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredRecords = lessonRecords.filter(r =>
    (r.topic || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.date || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectScenario = (scenario: GeneratedLessonScenario) => {
    const deck = createPresentationFromScenario(scenario, studentId, studentName);
    onImport(deck);
    onClose();
  };

  const handleSelectRecord = (record: LessonRecord) => {
    const deck = createPresentationFromLessonRecord(record, studentId, studentName);
    onImport(deck);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-200 border border-white/15 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-base-300/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-info/15 text-info">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Importuj materiał do prezentacji</h3>
              <p className="text-xs text-content-muted">Wybierz gotowy konspekt lub lekcję z historii kursanta</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs & Search */}
        <div className="p-4 border-b border-white/10 bg-base-300/40 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('scenarios')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === 'scenarios'
                  ? 'bg-primary text-accent-ink shadow-[0_0_12px_rgba(114,240,180,0.3)]'
                  : 'text-content-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles size={14} />
              <span>Scenariusze z Planera AI ({scenarios.length})</span>
            </button>
            <button
              onClick={() => setTab('records')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === 'records'
                  ? 'bg-info text-black shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                  : 'text-content-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={14} />
              <span>Historia lekcji kursanta ({lessonRecords.length})</span>
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj po temacie lub dacie..."
              className="w-full bg-base-300 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {tab === 'scenarios' ? (
            filteredScenarios.length === 0 ? (
              <div className="py-12 text-center text-content-muted text-xs">
                <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
                <p>Brak zapisanych scenariuszy.</p>
                <p className="text-[11px] opacity-70 mt-1">Wygeneruj scenariusz w Planerze lekcji AI lub stwórz prezentację od zera.</p>
              </div>
            ) : (
              filteredScenarios.map(sc => (
                <div
                  key={sc.id}
                  onClick={() => handleSelectScenario(sc)}
                  className="p-4 rounded-2xl bg-base-300/60 border border-white/10 hover:border-primary/40 hover:bg-base-300 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">
                        {sc.topic || sc.title}
                      </h4>
                      {sc.targetLevel && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white">
                          {sc.targetLevel}
                        </span>
                      )}
                      {sc.lessonDuration && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-content-muted">
                          {sc.lessonDuration}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-content-muted line-clamp-1">
                      {sc.studentName ? `Dla: ${sc.studentName} • ` : ''}
                      {sc.stages ? `${sc.stages.length} etapów` : 'Konspekt jednolity'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Wczytaj</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              ))
            )
          ) : (
            filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-content-muted text-xs">
                <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                <p>Brak zapisanych lekcji dla wybranego kursanta.</p>
              </div>
            ) : (
              filteredRecords.map(rec => (
                <div
                  key={rec.id}
                  onClick={() => handleSelectRecord(rec)}
                  className="p-4 rounded-2xl bg-base-300/60 border border-white/10 hover:border-info/40 hover:bg-base-300 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm group-hover:text-info transition-colors">
                        {rec.topic}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-content-muted">
                        {rec.date}
                      </span>
                    </div>
                    <p className="text-xs text-content-muted line-clamp-1">
                      {rec.lessonSummary || 'Lekcja z historii kursanta'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-info font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Utwórz powtórkę</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};
