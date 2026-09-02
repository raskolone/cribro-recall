import React, { useState, useEffect } from 'react';
import { 
  Sparkles, BookOpen, Layers, Clock, FileText, CheckCircle2, 
  ChevronDown, ChevronUp, Link as LinkIcon, ExternalLink, 
  User as UserIcon, MessageSquare, AlertTriangle, Target, Plus, Eye
} from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord, GeneratedLessonScenario, LessonScenarioStage } from '../../types';
import { getGeneratedScenarios, parseScenarioStages } from '../../services/scenarioService';
import Button from '../ui/Button';
import Card from '../ui/Card';
import TTSButtons from '../flashcards/TTSButtons';
import { ScenarioPreviewModal } from './ScenarioPreviewModal';

interface CascadingLessonDetailsProps {
  record: LessonRecord;
  studentName?: string;
  onLinkScenario?: (scenario: GeneratedLessonScenario) => Promise<void>;
  onGenerateHomework?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export const CascadingLessonDetails: React.FC<CascadingLessonDetailsProps> = ({
  record,
  studentName,
  onLinkScenario,
  onGenerateHomework,
  onEdit,
  onDelete,
  onClose
}) => {
  const [availableScenarios, setAvailableScenarios] = useState<GeneratedLessonScenario[]>([]);
  const [isLinkingOpen, setIsLinkingOpen] = useState(false);
  const [selectedScenarioForPreview, setSelectedScenarioForPreview] = useState<GeneratedLessonScenario | null>(null);
  
  // Section collapse states
  const [expandedSections, setExpandedSections] = useState<{
    basis: boolean;
    summary: boolean;
    speaking: boolean;
    vocab: boolean;
    improve: boolean;
    followUp: boolean;
  }>({
    basis: true,
    summary: true,
    speaking: false,
    vocab: true,
    improve: false,
    followUp: true
  });

  useEffect(() => {
    getGeneratedScenarios().then(scenarios => {
      setAvailableScenarios(scenarios);
    });
  }, []);

  // Find linked scenario or parse from record
  const linkedScenario = availableScenarios.find(s => s.id === record.scenarioId) || 
    (record.scenarioTopic ? {
      id: record.scenarioId || 'linked',
      title: record.scenarioTopic,
      topic: record.scenarioTopic,
      content: record.scenarioContent || '',
      stages: record.scenarioContent ? parseScenarioStages(record.scenarioContent).stages : [],
      createdAt: record.createdAt,
      studentId: record.studentId,
      studentName: studentName || null
    } as GeneratedLessonScenario : null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSelectScenarioToLink = async (scenario: GeneratedLessonScenario) => {
    if (onLinkScenario) {
      await onLinkScenario(scenario);
      setIsLinkingOpen(false);
    }
  };

  const parsedVocabList = (record.vocabularyText || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line, idx) => {
      let term = line;
      let def = '';
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        term = parts[0].trim();
        def = parts.slice(1).join(' - ').trim();
      } else if (line.includes(' – ')) {
        const parts = line.split(' – ');
        term = parts[0].trim();
        def = parts.slice(1).join(' – ').trim();
      } else if (line.includes(':')) {
        const parts = line.split(':');
        term = parts[0].trim();
        def = parts.slice(1).join(':').trim();
      }
      return { id: idx, term, def, raw: line };
    });

  return (
    <div className="space-y-4">
      {/* 1. Kaskadowe okno: Podstawa lekcji & Powiązany scenariusz */}
      <div className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden shadow-lg transition-all">
        <div 
          onClick={() => toggleSection('basis')}
          className="p-4 bg-base-300/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-300 transition-colors select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shrink-0">
              <Layers size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-extrabold text-sm text-white">Podstawa lekcji (Scenariusz bazowy)</h4>
                {linkedScenario ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                    <LinkIcon size={10} /> Powiązano z tematem
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-content-muted">
                    Brak powiązania
                  </span>
                )}
              </div>
              <p className="text-xs text-content-muted">
                {linkedScenario ? (linkedScenario.topic || linkedScenario.title) : 'Kliknij, aby powiązać ten wpis ze scenariuszem lekcji'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-content-muted">
              {expandedSections.basis ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
        </div>

        {expandedSections.basis && (
          <div className="p-4 space-y-3 border-t border-white/5 bg-base-200/30">
            {linkedScenario ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-base-300/80 border border-primary/20 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-primary font-bold flex items-center gap-1.5">
                      <Sparkles size={13} /> Scenariusz bazowy dla tej lekcji:
                    </div>
                    <div className="text-sm font-bold text-white">
                      {linkedScenario.topic || linkedScenario.title}
                    </div>
                    {linkedScenario.targetLevel && (
                      <div className="text-[11px] text-content-muted">
                        Poziom: {linkedScenario.targetLevel} • Czas: {linkedScenario.lessonDuration || '60 min'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedScenarioForPreview(linkedScenario)}
                      className="text-xs text-primary font-bold hover:bg-primary/10 flex items-center gap-1"
                    >
                      <Eye size={14} /> Pełny podgląd etapów
                    </Button>
                  </div>
                </div>

                {/* Stages cascading overview */}
                {linkedScenario.stages && linkedScenario.stages.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {linkedScenario.stages.map((stage, sIdx) => (
                      <div 
                        key={stage.id || sIdx}
                        className="p-3 rounded-xl bg-base-300/40 border border-white/5 text-xs space-y-1"
                      >
                        <div className="font-bold text-white flex items-center justify-between gap-2">
                          <span className="truncate">{stage.title}</span>
                          {stage.duration && (
                            <span className="text-[10px] text-content-muted font-mono shrink-0">
                              {stage.duration}
                            </span>
                          )}
                        </div>
                        <p className="text-content-muted line-clamp-2 leading-relaxed">
                          {stage.body.replace(/[#*`_]/g, '')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-base-300/30 border border-white/5 text-center space-y-3">
                <p className="text-xs text-content-muted">
                  Ten wpis lekcji nie ma jeszcze przypisanego scenariusza bazowego. Powiązanie pozwoli powiązać notatkę z konspektem i śledzić realizację etapów.
                </p>
                {onLinkScenario && (
                  <div>
                    {!isLinkingOpen ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setIsLinkingOpen(true)}
                        className="text-xs font-bold flex items-center gap-1.5 mx-auto"
                      >
                        <Plus size={14} /> Powiąż z wygenerowanym scenariuszem
                      </Button>
                    ) : (
                      <div className="space-y-2 text-left bg-base-300/80 p-3 rounded-xl border border-white/10 mt-2">
                        <div className="flex items-center justify-between text-xs font-bold text-white pb-1 border-b border-white/10">
                          <span>Wybierz scenariusz do powiązania:</span>
                          <button onClick={() => setIsLinkingOpen(false)} className="text-content-muted hover:text-white">
                            ✕
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5">
                          {availableScenarios.map(sc => (
                            <div
                              key={sc.id}
                              onClick={() => handleSelectScenarioToLink(sc)}
                              className="p-2.5 rounded-lg bg-base-200 hover:bg-primary/20 hover:border-primary/40 border border-white/5 cursor-pointer text-xs transition-all flex items-center justify-between"
                            >
                              <div className="font-bold text-white truncate mr-2">
                                {sc.topic || sc.title}
                              </div>
                              <span className="text-[10px] text-content-muted shrink-0">
                                {sc.targetLevel || 'B2'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Kaskadowe okno: Podsumowanie lekcji (Revision Notes) powiązane z tematem */}
      {record.lessonSummary && (
        <div className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden shadow-lg transition-all">
          <div 
            onClick={() => toggleSection('summary')}
            className="p-4 bg-base-300/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-300 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-info/20 text-info border border-info/30 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">Podsumowanie i Przebieg lekcji (Revision Notes)</h4>
                <p className="text-xs text-content-muted">Zapis zagadnień zrealizowanych na zajęciach</p>
              </div>
            </div>
            <div className="text-content-muted">
              {expandedSections.summary ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.summary && (
            <div className="p-4 border-t border-white/5 bg-base-200/30">
              <div className="text-sm text-content whitespace-pre-wrap leading-relaxed">
                {record.lessonSummary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Kaskadowe okno: Kursant — o czym mówił */}
      {record.studentSpeaking && (
        <div className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden shadow-lg transition-all">
          <div 
            onClick={() => toggleSection('speaking')}
            className="p-4 bg-base-300/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-300 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-secondary/20 text-secondary border border-secondary/30 flex items-center justify-center shrink-0">
                <MessageSquare size={16} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">Kursant — o czym mówił</h4>
                <p className="text-xs text-content-muted">Wypowiedzi, anegdoty i kontekst wypowiedzi kursanta</p>
              </div>
            </div>
            <div className="text-content-muted">
              {expandedSections.speaking ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.speaking && (
            <div className="p-4 border-t border-white/5 bg-base-200/30">
              <div className="text-sm text-content whitespace-pre-wrap leading-relaxed">
                {record.studentSpeaking}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Kaskadowe okno: Słownictwo & Wymowa */}
      {record.vocabularyText && (
        <div className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden shadow-lg transition-all">
          <div 
            onClick={() => toggleSection('vocab')}
            className="p-4 bg-base-300/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-300 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">
                  Słownictwo & Wymowa ({parsedVocabList.length})
                </h4>
                <p className="text-xs text-content-muted">Słowa i zwroty wprowadzone lub przećwiczone na lekcji</p>
              </div>
            </div>
            <div className="text-content-muted">
              {expandedSections.vocab ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.vocab && (
            <div className="p-4 border-t border-white/5 bg-base-200/30 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parsedVocabList.map(v => (
                  <div 
                    key={v.id}
                    className="p-2.5 rounded-xl bg-base-300/60 border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs">{v.term}</div>
                      {v.def && <div className="text-[11px] text-content-muted truncate">{v.def}</div>}
                    </div>
                    <TTSButtons text={v.term} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Kaskadowe okno: Things to Improve */}
      {record.thingsToImprove && (
        <div className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden shadow-lg transition-all">
          <div 
            onClick={() => toggleSection('improve')}
            className="p-4 bg-base-300/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-300 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-danger/20 text-danger border border-danger/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">Kwestie do poprawy (Things to Improve)</h4>
                <p className="text-xs text-content-muted">Częste błędy, gramatyka, wymowa</p>
              </div>
            </div>
            <div className="text-content-muted">
              {expandedSections.improve ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.improve && (
            <div className="p-4 border-t border-white/5 bg-base-200/30">
              <div className="text-sm text-content whitespace-pre-wrap leading-relaxed">
                {record.thingsToImprove}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Kaskadowe okno: Suggested Follow-up */}
      {record.suggestedFollowUp && (
        <div className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden shadow-lg transition-all">
          <div 
            onClick={() => toggleSection('followUp')}
            className="p-4 bg-base-300/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-300 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-warn/20 text-warn border border-warn/30 flex items-center justify-center shrink-0">
                <Target size={16} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">Zalecenia i Zadania (Suggested Follow-up)</h4>
                <p className="text-xs text-content-muted">Kolejne kroki, zadania powtórkowe</p>
              </div>
            </div>
            <div className="text-content-muted">
              {expandedSections.followUp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
          {expandedSections.followUp && (
            <div className="p-4 border-t border-white/5 bg-base-200/30">
              <div className="text-sm text-content whitespace-pre-wrap leading-relaxed">
                {record.suggestedFollowUp}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Preview Modal for linked scenario */}
      <ScenarioPreviewModal
        scenario={selectedScenarioForPreview}
        isOpen={Boolean(selectedScenarioForPreview)}
        onClose={() => setSelectedScenarioForPreview(null)}
      />
    </div>
  );
};
