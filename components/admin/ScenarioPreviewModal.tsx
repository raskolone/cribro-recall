import React, { useState } from 'react';
import { 
  X, Sparkles, BookOpen, Clock, Target, User as UserIcon, 
  Layers, Copy, Check, ChevronDown, ChevronUp, FileText, 
  CheckCircle2, Plus, Volume2, ArrowRight, Airplay
} from 'lucide-react';
import Markdown from 'react-markdown';
import { GeneratedLessonScenario, LessonScenarioStage } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import TTSButtons from '../flashcards/TTSButtons';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface ScenarioPreviewModalProps {
  scenario: GeneratedLessonScenario | null;
  isOpen: boolean;
  onClose: () => void;
  onInsertToLessonRecord?: (data: { 
    topic: string; 
    summary: string; 
    vocabulary: string; 
    followUp: string;
    scenarioId?: string;
    scenarioTopic?: string;
    scenarioContent?: string;
  }) => void;
  onLaunchPresentation?: (scenario: GeneratedLessonScenario) => void;
}

export const ScenarioPreviewModal: React.FC<ScenarioPreviewModalProps> = ({
  scenario,
  isOpen,
  onClose,
  onInsertToLessonRecord,
  onLaunchPresentation
}) => {
  useEscapeModal(isOpen, onClose);

  const [activeTab, setActiveTab] = useState<'stages' | 'vocabulary' | 'markdown'>('stages');
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  if (!isOpen || !scenario) return null;

  const stages: LessonScenarioStage[] = scenario.stages && scenario.stages.length > 0
    ? scenario.stages
    : [];

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: prev[stageId] === undefined ? true : !prev[stageId]
    }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    stages.forEach(s => { next[s.id] = true; });
    setExpandedStages(next);
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    stages.forEach(s => { next[s.id] = false; });
    setExpandedStages(next);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(scenario.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse vocabulary lines into terms & translations
  const parsedVocabList = (scenario.vocabularyText || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line, idx) => {
      let term = line;
      let definition = '';
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        term = parts[0].trim();
        definition = parts.slice(1).join(' - ').trim();
      } else if (line.includes(' – ')) {
        const parts = line.split(' – ');
        term = parts[0].trim();
        definition = parts.slice(1).join(' – ').trim();
      } else if (line.includes(':')) {
        const parts = line.split(':');
        term = parts[0].trim();
        definition = parts.slice(1).join(':').trim();
      }
      return { id: idx, term, definition, raw: line };
    });

  const getStageIcon = (title: string, index: number) => {
    const lower = title.toLowerCase();
    if (lower.includes('warm up') || lower.includes('rozgrzewka') || lower.includes('revision')) {
      return <Clock size={16} className="text-warn" />;
    }
    if (lower.includes('main topic') || lower.includes('główny')) {
      return <BookOpen size={16} className="text-primary" />;
    }
    if (lower.includes('language focus') || lower.includes('słownictwo') || lower.includes('vocabulary')) {
      return <Sparkles size={16} className="text-secondary" />;
    }
    if (lower.includes('practice') || lower.includes('ćwiczenia') || lower.includes('role-play')) {
      return <Target size={16} className="text-info" />;
    }
    if (lower.includes('homework') || lower.includes('zadanie') || lower.includes('domowa')) {
      return <FileText size={16} className="text-accent" />;
    }
    return <Layers size={16} className="text-primary" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-base-100 border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-base-200/60 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 flex items-center gap-1.5">
                <Sparkles size={12} /> Scenariusz lekcji
              </span>
              {scenario.studentName ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-white border border-white/10 flex items-center gap-1">
                  <UserIcon size={12} className="text-primary" /> Dla: {scenario.studentName}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-content-muted border border-white/5">
                  Ogólny konspekt
                </span>
              )}
              {scenario.targetLevel && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-content-muted border border-white/10">
                  Poziom {scenario.targetLevel}
                </span>
              )}
              {scenario.lessonDuration && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-content-muted border border-white/10">
                  ⏱️ {scenario.lessonDuration}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white truncate font-display">
              {scenario.topic || scenario.title}
            </h2>
            <p className="text-xs text-content-muted">
              Wygenerowano: {new Date(scenario.createdAt).toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          </div>

          {/* Action Buttons in Header */}
          <div className="flex items-center gap-2 shrink-0">
            {onInsertToLessonRecord && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onInsertToLessonRecord({
                    topic: scenario.topic || scenario.title,
                    summary: stages.find(s => s.title.toLowerCase().includes('main topic') || s.title.toLowerCase().includes('warm up'))?.body || '',
                    vocabulary: scenario.vocabularyText || '',
                    followUp: stages.find(s => s.title.toLowerCase().includes('homework'))?.body || '',
                    scenarioId: scenario.id,
                    scenarioTopic: scenario.topic || scenario.title,
                    scenarioContent: scenario.content
                  });
                  onClose();
                }}
                className="font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(114,240,180,0.3)] hover:scale-105"
              >
                <Plus size={15} /> Przypisz do historii
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAll}
              className="text-xs text-content-muted hover:text-white"
            >
              {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'Skopiowano' : 'Kopiuj'}</span>
            </Button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="px-6 py-2.5 bg-base-200/30 border-b border-white/5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('stages')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'stages'
                  ? 'bg-primary text-accent-ink shadow-[0_0_12px_rgba(114,240,180,0.3)]'
                  : 'bg-white/5 text-content-muted hover:text-white hover:bg-white/10'
              }`}
            >
              <Layers size={13} />
              <span>Etapy lekcji ({stages.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('vocabulary')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'vocabulary'
                  ? 'bg-primary text-accent-ink shadow-[0_0_12px_rgba(114,240,180,0.3)]'
                  : 'bg-white/5 text-content-muted hover:text-white hover:bg-white/10'
              }`}
            >
              <Sparkles size={13} />
              <span>Słownictwo ({parsedVocabList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'markdown'
                  ? 'bg-primary text-accent-ink shadow-[0_0_12px_rgba(114,240,180,0.3)]'
                  : 'bg-white/5 text-content-muted hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText size={13} />
              <span>Tekst Markdown</span>
            </button>
          </div>

          {activeTab === 'stages' && stages.length > 1 && (
            <div className="flex items-center gap-2 text-[11px] text-content-muted">
              <button onClick={handleExpandAll} className="hover:text-primary transition-colors cursor-pointer">
                Rozwiń wszystkie
              </button>
              <span>•</span>
              <button onClick={handleCollapseAll} className="hover:text-primary transition-colors cursor-pointer">
                Zwiń wszystkie
              </button>
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 max-h-[60vh]">
          {/* TAB 1: STAGES ACCORDION VIEW (Like student panel lesson history) */}
          {activeTab === 'stages' && (
            <div className="space-y-3">
              {stages.map((stage, idx) => {
                const isOpen = expandedStages[stage.id] ?? (idx === 0 || idx === 1);
                return (
                  <div 
                    key={stage.id} 
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isOpen 
                        ? 'bg-base-200/70 border-primary/30 shadow-[0_0_16px_rgba(114,240,180,0.08)]' 
                        : 'bg-base-200/30 border-white/5 hover:border-white/15'
                    }`}
                  >
                    {/* Stage Header */}
                    <div 
                      onClick={() => toggleStage(stage.id)}
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.03] transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          {getStageIcon(stage.title, idx)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white flex items-center gap-2">
                            <span>{stage.title}</span>
                            {stage.duration && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-content-muted border border-white/5">
                                {stage.duration}
                              </span>
                            )}
                          </h4>
                        </div>
                      </div>
                      <div className="text-content-muted hover:text-white transition-colors">
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Stage Body */}
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/5">
                        <div className="prose prose-invert prose-sm max-w-none text-content-muted leading-relaxed font-sans">
                          <Markdown>{stage.body}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: VOCABULARY DEDICATED CARDS */}
          {activeTab === 'vocabulary' && (
            <div className="space-y-3">
              {parsedVocabList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {parsedVocabList.map(v => (
                    <div 
                      key={v.id}
                      className="p-3.5 rounded-2xl bg-base-200/50 border border-white/10 hover:border-primary/40 transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">
                            {v.term}
                          </h4>
                          <TTSButtons text={v.term} />
                        </div>
                        {v.definition && (
                          <p className="text-xs text-content-muted font-medium">
                            {v.definition}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-base-200/30 rounded-2xl border border-white/5">
                  <p className="text-sm text-content-muted">Brak wyodrębnionego słownictwa dla tego scenariusza.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RAW MARKDOWN */}
          {activeTab === 'markdown' && (
            <div className="p-4 rounded-2xl bg-base-200/80 border border-white/10">
              <pre className="text-xs text-content font-mono whitespace-pre-wrap leading-relaxed">
                {scenario.content}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-white/10 bg-base-200/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-content-muted flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-primary" />
            <span>Scenariusz gotowy do wykorzystania na zajęciach</span>
          </div>
          <div className="flex items-center gap-2">
            {onLaunchPresentation && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onLaunchPresentation(scenario);
                  onClose();
                }}
                className="text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(114,240,180,0.25)]"
              >
                <Airplay size={14} />
                <span>Uruchom prezentację dla kursanta</span>
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              Zamknij
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
