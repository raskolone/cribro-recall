import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronDown, ChevronRight, Copy, Check, BookOpen, 
  FileText, Sparkles, Clock, CheckCircle2, Layers, AlignLeft,
  Trash2, Edit2, Plus, ArrowUp, ArrowDown, X, Save, RefreshCw,
  AlertTriangle, RotateCcw, GripVertical, Zap, ArrowRight, Lightbulb,
  ExternalLink, ListPlus, Bold, HelpCircle, CheckSquare
} from 'lucide-react';
import Markdown from 'react-markdown';
import { SAMPLE_MODULES_CATALOG } from './lessonPlannerPresets';

interface ScenarioBlock {
  id: string;
  title: string;
  duration?: string;
  body: string;
}

interface LessonScenarioAccordionProps {
  content: string;
  onCopyText: (id: string, text: string) => void;
  copiedId: string | null;
  extractedVocab?: string;
  onInsertLessonRecord?: (data: { topic: string; summary: string; vocabulary: string; followUp: string }) => void;
  onUpdateContent?: (newContent: string) => void;
  onDeleteScenario?: () => void;
  onSelectTopicPrompt?: (prompt: string) => void;
}

export const LessonScenarioAccordion: React.FC<LessonScenarioAccordionProps> = ({
  content,
  onCopyText,
  copiedId,
  extractedVocab,
  onInsertLessonRecord,
  onUpdateContent,
  onDeleteScenario,
  onSelectTopicPrompt
}) => {
  const [isScenarioOpen, setIsScenarioOpen] = useState(true);
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'accordion' | 'markdown'>('accordion');

  // Drag & Drop State for blocks
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Inline editing state for blocks
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editBlockTitle, setEditBlockTitle] = useState('');
  const [editBlockBody, setEditBlockBody] = useState('');

  // Editing scenario main title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [scenarioTitleDraft, setScenarioTitleDraft] = useState('');

  // Add block modal/state
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockBody, setNewBlockBody] = useState('');

  // Markdown direct editing mode
  const [isEditingFullMarkdown, setIsEditingFullMarkdown] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState(content);

  // Parse markdown into scenario title and blocks
  const parsedScenario = useMemo(() => {
    if (!content) {
      return { title: 'Scenariusz lekcji', blocks: [] as ScenarioBlock[] };
    }

    const lines = content.split('\n');
    let scenarioTitle = '';
    const blocks: ScenarioBlock[] = [];
    let currentBlock: ScenarioBlock | null = null;
    const bodyLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for main scenario title e.g. "# Scenariusz: ..." or "**Scenariusz:** ..." or "# Topic..."
      if (!scenarioTitle && (trimmed.startsWith('# ') || trimmed.toLowerCase().startsWith('scenariusz:') || trimmed.toLowerCase().startsWith('**scenariusz:'))) {
        scenarioTitle = trimmed
          .replace(/^#+\s*/, '')
          .replace(/^\*\*scenariusz:\*\*/i, '')
          .replace(/^scenariusz:\s*/i, '')
          .replace(/\*\*/g, '')
          .trim();
        if (!scenarioTitle.toLowerCase().startsWith('scenariusz')) {
          scenarioTitle = `Scenariusz: ${scenarioTitle}`;
        }
        continue;
      }

      // Check for section header e.g. "## 1. Revision and Warm Up (15–20 min)" or "### 1. ..." or "**1. Revision...**"
      const isHeaderMatch = 
        trimmed.startsWith('## ') || 
        trimmed.startsWith('### ') || 
        /^(\*\*)?\s*(\d+\.|\d+\))\s+[A-Za-zĄ-ź\s–-]+(\(\d+.*?\))?(\*\*)?:?$/.test(trimmed) ||
        (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 80 && (trimmed.includes('min') || /^\*\*\d+\./.test(trimmed)));

      if (isHeaderMatch) {
        // Save previous block
        if (currentBlock) {
          currentBlock.body = bodyLines.join('\n').trim();
          blocks.push(currentBlock);
          bodyLines.length = 0;
        }

        const rawTitle = trimmed
          .replace(/^#+\s*/, '')
          .replace(/\*\*/g, '')
          .replace(/:$/, '')
          .trim();

        // Extract duration from title if present
        const durationMatch = rawTitle.match(/\((.*?min.*?)\)/i);
        const duration = durationMatch ? durationMatch[1] : undefined;

        currentBlock = {
          id: `block-${blocks.length + 1}-${rawTitle.slice(0, 15).replace(/\s+/g, '-')}`,
          title: rawTitle,
          duration,
          body: ''
        };
        continue;
      }

      if (currentBlock) {
        bodyLines.push(line);
      } else {
        // Intro content before first block
        if (trimmed && !scenarioTitle) {
          scenarioTitle = `Scenariusz: ${trimmed.slice(0, 50)}`;
        }
      }
    }

    if (currentBlock) {
      currentBlock.body = bodyLines.join('\n').trim();
      blocks.push(currentBlock);
    }

    if (!scenarioTitle) {
      scenarioTitle = 'Scenariusz lekcji';
    }

    return { title: scenarioTitle, blocks };
  }, [content]);

  // Keep markdownDraft in sync when content changes from outside
  useEffect(() => {
    setMarkdownDraft(content);
  }, [content]);

  // Extract conversational topic suggestions if this is a topic recommendation response
  const detectedSuggestedTopics = useMemo(() => {
    if (parsedScenario.blocks.length > 0) return [];
    const lines = content.split('\n');
    const topics: { title: string; prompt: string }[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/^(\d+\.|\*|###|\-)\s*(\*\*)?([A-Za-z0-9Ą-ź\s–—\-:,&"]+?)(\*\*)?:?\s*$/);
      if (match && match[3] && match[3].length > 6 && match[3].length < 100) {
        const cleanTopic = match[3].replace(/^Temat\s*\d*:\s*/i, '').replace(/^Opcja\s*\d*:\s*/i, '').replace(/["']/g, '').trim();
        if (cleanTopic && !topics.some(t => t.title === cleanTopic)) {
          topics.push({
            title: cleanTopic,
            prompt: `Przygotuj kompletny scenariusz lekcji na temat "${cleanTopic}" według skonfigurowanych modułów.`
          });
        }
      }
    }
    return topics.slice(0, 4);
  }, [content, parsedScenario.blocks.length]);

  // Reconstruct Markdown helper
  const reconstructMarkdown = (title: string, blocks: ScenarioBlock[]): string => {
    const cleanTitle = title.replace(/^#+\s*/, '').trim();
    let md = `# ${cleanTitle}\n\n`;
    blocks.forEach((b, idx) => {
      let blockTitle = b.title.replace(/^#+\s*/, '').trim();
      // Ensure clean numbering if not present
      if (!/^\d+\./.test(blockTitle) && !blockTitle.toLowerCase().includes('homework')) {
        blockTitle = `${idx + 1}. ${blockTitle}`;
      }
      md += `## ${blockTitle}\n${b.body ? b.body.trim() : ''}\n\n`;
    });
    return md.trim();
  };

  const toggleBlock = (blockId: string) => {
    setOpenBlocks(prev => ({
      ...prev,
      [blockId]: prev[blockId] === undefined ? true : !prev[blockId]
    }));
  };

  const handleExpandAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allOpen: Record<string, boolean> = {};
    parsedScenario.blocks.forEach(b => {
      allOpen[b.id] = true;
    });
    setOpenBlocks(allOpen);
    setIsScenarioOpen(true);
  };

  const handleCollapseAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allClosed: Record<string, boolean> = {};
    parsedScenario.blocks.forEach(b => {
      allClosed[b.id] = false;
    });
    setOpenBlocks(allClosed);
  };

  // Drag and Drop handlers for blocks
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !onUpdateContent) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const next = [...parsedScenario.blocks];
    const moved = next.splice(draggedIndex, 1)[0];
    next.splice(targetIndex, 0, moved);

    const newMd = reconstructMarkdown(parsedScenario.title, next);
    onUpdateContent(newMd);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Delete a single module/block from the generated scenario
  const handleDeleteBlock = (blockId: string, blockTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onUpdateContent) return;

    if (parsedScenario.blocks.length <= 1) {
      if (window.confirm('To jest jedyny moduł w tym scenariuszu. Usunięcie go usunie cały scenariusz. Czy na pewno chcesz to zrobić?')) {
        if (onDeleteScenario) {
          onDeleteScenario();
        } else {
          onUpdateContent('');
        }
      }
      return;
    }

    if (window.confirm(`Czy na pewno chcesz usunąć moduł "${blockTitle}" ze scenariusza?`)) {
      const updatedBlocks = parsedScenario.blocks.filter(b => b.id !== blockId);
      const newMd = reconstructMarkdown(parsedScenario.title, updatedBlocks);
      onUpdateContent(newMd);
    }
  };

  // Start editing a block
  const handleStartEditBlock = (block: ScenarioBlock, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingBlockId(block.id);
    setEditBlockTitle(block.title);
    setEditBlockBody(block.body);
    setOpenBlocks(prev => ({ ...prev, [block.id]: true }));
  };

  // Save edited block
  const handleSaveEditBlock = (blockId: string) => {
    if (!onUpdateContent) return;
    if (!editBlockTitle.trim()) return;

    const updatedBlocks = parsedScenario.blocks.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          title: editBlockTitle.trim(),
          body: editBlockBody.trim()
        };
      }
      return b;
    });

    const newMd = reconstructMarkdown(parsedScenario.title, updatedBlocks);
    onUpdateContent(newMd);
    setEditingBlockId(null);
  };

  const handleCancelEditBlock = () => {
    setEditingBlockId(null);
  };

  // Quick insertion helpers for editor
  const handleInsertSnippet = (snippet: string) => {
    setEditBlockBody(prev => prev ? `${prev}\n${snippet}` : snippet);
  };

  // Move block up
  const handleMoveBlockUp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index <= 0 || !onUpdateContent) return;
    const next = [...parsedScenario.blocks];
    const temp = next[index];
    next[index] = next[index - 1];
    next[index - 1] = temp;
    const newMd = reconstructMarkdown(parsedScenario.title, next);
    onUpdateContent(newMd);
  };

  // Move block down
  const handleMoveBlockDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index >= parsedScenario.blocks.length - 1 || !onUpdateContent) return;
    const next = [...parsedScenario.blocks];
    const temp = next[index];
    next[index] = next[index + 1];
    next[index + 1] = temp;
    const newMd = reconstructMarkdown(parsedScenario.title, next);
    onUpdateContent(newMd);
  };

  // Add custom block directly into scenario
  const handleAddBlockToScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockTitle.trim() || !onUpdateContent) return;

    const newBlock: ScenarioBlock = {
      id: `block-custom-${Date.now()}`,
      title: newBlockTitle.trim(),
      body: newBlockBody.trim() || '- *Wpisz treść lub uzupełnij materiały dla tego etapu.*'
    };

    const updatedBlocks = [...parsedScenario.blocks, newBlock];
    const newMd = reconstructMarkdown(parsedScenario.title, updatedBlocks);
    onUpdateContent(newMd);

    setNewBlockTitle('');
    setNewBlockBody('');
    setShowAddBlockModal(false);
  };

  // Add from sample catalog
  const handleAddFromCatalog = (item: typeof SAMPLE_MODULES_CATALOG[0]) => {
    if (!onUpdateContent) return;
    const newBlock: ScenarioBlock = {
      id: `block-cat-${Date.now()}`,
      title: `${parsedScenario.blocks.length + 1}. ${item.title}`,
      duration: item.duration,
      body: `- **Cel modułu**: ${item.placeholderInstruction}\n- *Wpisz treść lub uzupełnij materiały dla tego etapu.*`
    };

    const updatedBlocks = [...parsedScenario.blocks, newBlock];
    const newMd = reconstructMarkdown(parsedScenario.title, updatedBlocks);
    onUpdateContent(newMd);
    setShowAddBlockModal(false);
  };

  // Save edited scenario title
  const handleSaveTitle = () => {
    if (!onUpdateContent) return;
    if (!scenarioTitleDraft.trim()) {
      setIsEditingTitle(false);
      return;
    }
    const newTitle = scenarioTitleDraft.trim();
    const newMd = reconstructMarkdown(newTitle, parsedScenario.blocks);
    onUpdateContent(newMd);
    setIsEditingTitle(false);
  };

  // Delete entire scenario
  const handleDeleteWholeScenario = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Czy na pewno chcesz usunąć ten wygenerowany scenariusz lekcji?')) {
      if (onDeleteScenario) {
        onDeleteScenario();
      } else if (onUpdateContent) {
        onUpdateContent('');
      }
    }
  };

  // Save direct markdown draft
  const handleSaveMarkdownDraft = () => {
    if (onUpdateContent) {
      onUpdateContent(markdownDraft);
    }
    setIsEditingFullMarkdown(false);
  };

  // Smart Transfer to Lesson Record
  const handleInsertToLessonRecord = () => {
    if (!onInsertLessonRecord) return;
    
    // Extract clean topic name
    const topic = parsedScenario.title
      .replace(/^#+\s*/, '')
      .replace(/^Scenariusz:\s*/i, '')
      .trim() || 'Scenariusz lekcji';
    
    // Extract vocabulary
    let vocab = extractedVocab || '';
    if (!vocab) {
      const vocabBlock = parsedScenario.blocks.find(b => 
        b.title.toLowerCase().includes('language focus') || 
        b.title.toLowerCase().includes('słownictwo') || 
        b.title.toLowerCase().includes('vocabulary') ||
        b.title.toLowerCase().includes('idiom')
      );
      if (vocabBlock) {
        vocab = vocabBlock.body;
      }
    }

    // Extract follow up / homework
    let followUp = '';
    const homeworkBlock = parsedScenario.blocks.find(b => 
      b.title.toLowerCase().includes('homework') || 
      b.title.toLowerCase().includes('praca domowa') || 
      b.title.toLowerCase().includes('follow up') ||
      b.title.toLowerCase().includes('zadanie')
    );
    if (homeworkBlock) {
      followUp = homeworkBlock.body;
    }

    // Extract summary
    let summary = '';
    const mainTopicBlock = parsedScenario.blocks.find(b => 
      b.title.toLowerCase().includes('main topic') || 
      b.title.toLowerCase().includes('główny temat')
    );
    const warmUpBlock = parsedScenario.blocks.find(b => 
      b.title.toLowerCase().includes('warm up') || 
      b.title.toLowerCase().includes('revision')
    );
    const practiceBlock = parsedScenario.blocks.find(b => 
      b.title.toLowerCase().includes('practice') || 
      b.title.toLowerCase().includes('ćwiczenia')
    );

    if (mainTopicBlock || warmUpBlock || practiceBlock) {
      const parts: string[] = [];
      if (warmUpBlock) parts.push(`• Warm Up: ${warmUpBlock.body.slice(0, 200)}...`);
      if (mainTopicBlock) parts.push(`• Main Topic: ${mainTopicBlock.body.slice(0, 300)}...`);
      if (practiceBlock) parts.push(`• Practice: ${practiceBlock.body.slice(0, 200)}...`);
      summary = parts.join('\n\n');
    } else {
      summary = parsedScenario.blocks.map(b => `### ${b.title}\n${b.body}`).join('\n\n');
    }

    onInsertLessonRecord({
      topic,
      summary,
      vocabulary: vocab,
      followUp
    });
  };

  // If there are no structured blocks parsed (e.g. conversational answer or topic suggestions), render standard markdown with smart action buttons
  if (parsedScenario.blocks.length === 0) {
    return (
      <div className="space-y-4 font-sans">
        <div className="flex items-center justify-between gap-2 pb-2 text-xs border-b border-white/10">
          <div className="flex items-center gap-2 text-primary text-xs font-extrabold tracking-wide">
            <Sparkles size={15} className="text-primary animate-pulse" />
            <span className="drop-shadow-[0_0_8px_rgba(114,240,180,0.4)]">Doradca metodyczny AI</span>
          </div>
          {onDeleteScenario && (
            <button
              type="button"
              onClick={handleDeleteWholeScenario}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:shadow-[0_0_12px_rgba(248,113,113,0.35)] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Usuń tę wiadomość"
            >
              <Trash2 size={13} />
              <span>Usuń</span>
            </button>
          )}
        </div>

        <div className="prose prose-invert max-w-none text-sm leading-relaxed text-content-base [&>h1]:text-primary [&>h2]:text-primary [&>h3]:text-white [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm [&>ul]:space-y-1.5 [&>ol]:space-y-1.5 [&>p]:leading-relaxed">
          <Markdown>{content}</Markdown>
        </div>

        {/* Quick action buttons if topics were detected */}
        {detectedSuggestedTopics.length > 0 && onSelectTopicPrompt && (
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-warn uppercase tracking-wider">
              <Lightbulb size={14} className="text-warn animate-bounce" />
              <span>Zaproponowane tematy — wygeneruj konspekt jednym kliknięciem:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {detectedSuggestedTopics.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectTopicPrompt(t.prompt)}
                  className="p-3 rounded-2xl bg-gradient-to-r from-primary/15 to-base-200/80 hover:from-primary/25 hover:to-base-200 border border-primary/30 hover:border-primary text-white hover:text-primary text-xs font-bold flex items-center justify-between gap-2 transition-all shadow-sm hover:shadow-[0_0_15px_rgba(114,240,180,0.25)] hover:scale-[1.01] active:scale-95 text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-primary shrink-0 group-hover:scale-110 transition-transform" />
                    <span>{t.title}</span>
                  </div>
                  <ArrowRight size={13} className="shrink-0 text-primary opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {/* Top View Mode & Action Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 text-xs border-b border-white/10">
        <div className="flex items-center gap-1.5 bg-base-200/90 p-1 rounded-2xl border border-white/15 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setViewMode('accordion');
              setIsEditingFullMarkdown(false);
            }}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
              viewMode === 'accordion'
                ? 'bg-primary text-accent-ink shadow-[0_0_12px_rgba(114,240,180,0.35)]'
                : 'text-content-muted hover:text-white'
            }`}
          >
            <Layers size={14} />
            <span>Widok bloków</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('markdown')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
              viewMode === 'markdown'
                ? 'bg-primary text-accent-ink shadow-[0_0_12px_rgba(114,240,180,0.35)]'
                : 'text-content-muted hover:text-white'
            }`}
          >
            <AlignLeft size={14} />
            <span>Tekst Markdown</span>
          </button>
        </div>

        {/* Global Scenario Action Buttons: Insert into Record, Expand, Delete */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* Transfer directly to Lesson Record note modal */}
          {onInsertLessonRecord && (
            <button
              type="button"
              onClick={handleInsertToLessonRecord}
              className="px-3.5 py-1.5 rounded-xl bg-primary/20 hover:bg-primary text-primary hover:text-accent-ink border border-primary/40 hover:border-primary font-extrabold flex items-center gap-1.5 transition-all shadow-sm hover:shadow-[0_0_16px_rgba(114,240,180,0.3)] hover:scale-[1.02] active:scale-95 cursor-pointer"
              title="Wstaw ten scenariusz i słówka bezpośrednio do nowej notatki z lekcji"
            >
              <FileText size={14} />
              <span>Utwórz wpis w historii lekcji</span>
            </button>
          )}

          {viewMode === 'accordion' && (
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white transition-colors cursor-pointer"
              >
                Rozwiń
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white transition-colors cursor-pointer"
              >
                Zwiń
              </button>
            </div>
          )}

          {/* Delete Whole Scenario Button */}
          {onDeleteScenario && (
            <button
              type="button"
              onClick={handleDeleteWholeScenario}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 hover:shadow-[0_0_14px_rgba(248,113,113,0.35)] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Usuń ten wygenerowany scenariusz z historii czatu"
            >
              <Trash2 size={13} />
              <span>Usuń scenariusz</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'markdown' ? (
        <div className="space-y-3 animate-fade-in">
          {isEditingFullMarkdown ? (
            <div className="p-4 rounded-3xl bg-base-100 border border-primary/40 space-y-3 shadow-[0_0_20px_rgba(114,240,180,0.15)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-extrabold text-primary flex items-center gap-2">
                  <Edit2 size={14} />
                  Edycja pełnego kodu Markdown scenariusza:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveMarkdownDraft}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-accent-ink font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(114,240,180,0.3)] hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Save size={13} />
                    <span>Zapisz zmiany</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMarkdownDraft(content);
                      setIsEditingFullMarkdown(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-content-muted hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
              <textarea
                value={markdownDraft}
                onChange={(e) => setMarkdownDraft(e.target.value)}
                rows={16}
                className="w-full p-4 text-xs font-mono bg-base-200 border border-white/20 rounded-2xl text-white focus:border-primary focus:shadow-[0_0_15px_rgba(114,240,180,0.2)] focus:outline-none resize-y leading-relaxed"
              />
            </div>
          ) : (
            <div className="relative group">
              <div className="absolute right-3 top-3 z-10 opacity-90 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                {onUpdateContent && (
                  <button
                    type="button"
                    onClick={() => setIsEditingFullMarkdown(true)}
                    className="px-3 py-1.5 rounded-xl bg-base-200/90 hover:bg-base-200 text-white hover:text-primary font-bold text-xs flex items-center gap-1.5 backdrop-blur-md border border-white/20 shadow-md transition-all cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>Edytuj Markdown</span>
                  </button>
                )}
              </div>
              <div className="prose prose-invert max-w-none text-sm leading-relaxed p-5 bg-base-200/60 rounded-3xl border border-white/15 [&>h1]:text-primary [&>h2]:text-primary [&>h3]:text-white [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm [&>ul]:space-y-1 [&>ol]:space-y-1">
                <Markdown>{content}</Markdown>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ACCORDION VIEW WITH DRAG & DROP AND EDITING */
        <div className="rounded-3xl border border-white/20 bg-base-200/60 overflow-hidden shadow-xl">
          {/* Main Scenario Header */}
          <div
            onClick={() => setIsScenarioOpen(!isScenarioOpen)}
            className="p-3.5 sm:p-4 bg-gradient-to-r from-primary/20 via-base-100/90 to-base-100/90 border-b border-white/10 flex items-center justify-between cursor-pointer select-none group transition-colors hover:bg-base-100"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-primary font-extrabold text-sm sm:text-base drop-shadow-[0_0_8px_rgba(114,240,180,0.5)]">
                {isScenarioOpen ? '▼' : '▶'}
              </span>

              {isEditingTitle ? (
                <div className="flex items-center gap-2 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={scenarioTitleDraft}
                    onChange={(e) => setScenarioTitleDraft(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-base-200 border border-primary text-white text-sm font-bold w-full max-w-md focus:outline-none shadow-[0_0_12px_rgba(114,240,180,0.3)]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="p-1.5 rounded-xl bg-primary text-accent-ink hover:brightness-110 shadow-sm cursor-pointer"
                    title="Zapisz tytuł"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(false)}
                    className="p-1.5 rounded-xl bg-white/10 text-content-muted hover:text-white cursor-pointer"
                    title="Anuluj"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <h3 className="font-black text-sm sm:text-base text-white group-hover:text-primary transition-colors truncate tracking-tight">
                    {parsedScenario.title}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScenarioTitleDraft(parsedScenario.title);
                      setIsEditingTitle(true);
                    }}
                    className="p-1.5 rounded-lg text-content-muted hover:text-primary hover:bg-white/10 transition-all cursor-pointer"
                    title="Zmień tytuł scenariusza"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              )}

              <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 text-[11px] font-mono font-bold shrink-0 hidden sm:inline-block shadow-[0_0_10px_rgba(114,240,180,0.15)]">
                {parsedScenario.blocks.length} modułów
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onCopyText('scenario-all', content)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-white/10 cursor-pointer"
                title="Kopiuj cały scenariusz do schowka"
              >
                {copiedId === 'scenario-all' ? (
                  <>
                    <Check size={13} className="text-primary" />
                    <span className="text-primary text-[11px]">Skopiowano!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span className="text-[11px]">Kopiuj</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Scenario Sub-blocks with Drag & Drop */}
          {isScenarioOpen && (
            <div className="p-3 sm:p-4 space-y-3 bg-ink/75">
              {parsedScenario.blocks.map((block, idx) => {
                const isOpen = openBlocks[block.id] ?? false;
                const isEditingThisBlock = editingBlockId === block.id;
                const isDraggingThis = draggedIndex === idx;
                const isDragOverThis = dragOverIndex === idx;

                return (
                  <div
                    key={block.id}
                    draggable={!isEditingThisBlock}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isDraggingThis
                        ? 'opacity-40 scale-[0.99] border-dashed border-primary'
                        : isDragOverThis
                        ? 'border-primary ring-2 ring-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(114,240,180,0.25)] scale-[1.01]'
                        : isEditingThisBlock
                        ? 'border-primary/70 bg-base-100 shadow-[0_0_20px_rgba(114,240,180,0.2)]'
                        : isOpen
                        ? 'border-primary/40 bg-base-100/95 shadow-md'
                        : 'border-white/10 bg-base-100/50 hover:border-white/25 hover:bg-base-100/80'
                    }`}
                  >
                    {/* Block Trigger Header */}
                    <div
                      onClick={() => !isEditingThisBlock && toggleBlock(block.id)}
                      className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer select-none transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Drag Handle */}
                        {!isEditingThisBlock && onUpdateContent && (
                          <span 
                            className="text-content-muted/60 hover:text-primary cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/5 transition-colors shrink-0"
                            title="Przeciągnij moduł, aby zmienić kolejność (Drag & Drop)"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical size={15} />
                          </span>
                        )}

                        <span className="text-content-muted group-hover:text-primary text-xs font-bold transition-colors">
                          {isOpen ? '▼' : '▶'}
                        </span>
                        <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-primary transition-colors truncate">
                          {block.title}
                        </h4>
                        {block.duration && (
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-content-muted shrink-0 hidden md:inline-block">
                            {block.duration}
                          </span>
                        )}
                      </div>

                      {/* Block Controls: Reorder, Edit, Delete, Copy */}
                      <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        {onUpdateContent && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleMoveBlockUp(idx, e)}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg text-content-muted hover:text-white disabled:opacity-20 hover:bg-white/10 transition-colors cursor-pointer"
                              title="Przesuń blok wyżej"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleMoveBlockDown(idx, e)}
                              disabled={idx === parsedScenario.blocks.length - 1}
                              className="p-1.5 rounded-lg text-content-muted hover:text-white disabled:opacity-20 hover:bg-white/10 transition-colors cursor-pointer"
                              title="Przesuń blok niżej"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleStartEditBlock(block, e)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-primary/20 text-content-muted hover:text-primary border border-white/10 hover:border-primary/30 transition-all ml-0.5 cursor-pointer"
                              title="Edytuj treść tego modułu"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteBlock(block.id, block.title, e)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-content-muted hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all cursor-pointer"
                              title="Usuń ten moduł ze scenariusza"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => onCopyText(block.id, `${block.title}\n\n${block.body}`)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-content-muted hover:text-white border border-white/10 transition-colors ml-0.5 cursor-pointer"
                          title="Kopiuj treść tego modułu"
                        >
                          {copiedId === block.id ? (
                            <Check size={13} className="text-primary" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Block Content or Inline Editor */}
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/10 animate-fade-in">
                        {isEditingThisBlock ? (
                          <div className="space-y-3 pt-2">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                                Tytuł modułu / Nagłówek:
                              </label>
                              <input
                                type="text"
                                value={editBlockTitle}
                                onChange={(e) => setEditBlockTitle(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl bg-base-200 border border-primary/60 text-white text-xs font-bold focus:border-primary focus:shadow-[0_0_10px_rgba(114,240,180,0.25)] focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                                  Treść modułu (Markdown / tekst):
                                </label>
                                {/* Quick helpers */}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleInsertSnippet('- ')}
                                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-content-muted hover:text-white transition-colors"
                                  >
                                    + Punkt
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleInsertSnippet('- **Zwrot** – tłumaczenie (*"Przykładowe zdanie"*)\n')}
                                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-content-muted hover:text-white transition-colors"
                                  >
                                    + Słówko
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleInsertSnippet('1. *Pytanie dyskusyjne w kursywie?*\n')}
                                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-content-muted hover:text-white transition-colors"
                                  >
                                    + Pytanie
                                  </button>
                                </div>
                              </div>
                              <textarea
                                value={editBlockBody}
                                onChange={(e) => setEditBlockBody(e.target.value)}
                                rows={8}
                                className="w-full p-3.5 bg-base-200 border border-white/20 rounded-2xl text-white text-xs font-mono focus:border-primary focus:shadow-[0_0_15px_rgba(114,240,180,0.2)] focus:outline-none leading-relaxed"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCancelEditBlock}
                                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-content-muted hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Anuluj
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditBlock(block.id)}
                                className="px-4 py-1.5 rounded-xl bg-primary text-accent-ink font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(114,240,180,0.35)] hover:brightness-110 transition-all cursor-pointer"
                              >
                                <Save size={13} />
                                <span>Zapisz zmiany</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-content [&>ul]:space-y-1.5 [&>ol]:space-y-1.5 pt-2 [&>p]:leading-relaxed">
                            <Markdown>{block.body || '_Brak treści w tym module._'}</Markdown>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Module to Scenario Action */}
              {onUpdateContent && (
                <div className="pt-1">
                  {showAddBlockModal ? (
                    <div className="p-4 rounded-3xl bg-base-100 border border-primary/40 space-y-3.5 shadow-[0_0_20px_rgba(114,240,180,0.15)] animate-fade-in">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-extrabold text-white flex items-center gap-2">
                          <Plus size={15} className="text-primary" />
                          Dodaj nowy moduł do tego scenariusza
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddBlockModal(false)}
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Quick Add from Sample Catalog */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider">
                          Wybierz gotowy typ modułu:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {SAMPLE_MODULES_CATALOG.slice(0, 6).map((cat, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleAddFromCatalog(cat)}
                              className="p-2.5 rounded-xl bg-base-200/80 hover:bg-base-200 border border-white/10 hover:border-primary/40 text-left transition-all text-xs group cursor-pointer"
                            >
                              <div className="font-bold text-white group-hover:text-primary transition-colors flex items-center justify-between">
                                <span>{cat.title}</span>
                                <span className="text-[10px] text-primary/80 font-mono">{cat.duration}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Or custom title & body */}
                      <form onSubmit={handleAddBlockToScenario} className="space-y-2.5 pt-2 border-t border-white/10">
                        <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider">
                          Albo wpisz własny moduł:
                        </div>
                        <input
                          type="text"
                          value={newBlockTitle}
                          onChange={(e) => setNewBlockTitle(e.target.value)}
                          placeholder="Np. 6. Wymowa i Fonetyka (Connected Speech)"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-base-200 border border-white/15 text-white text-xs font-bold focus:border-primary focus:outline-none"
                        />
                        <textarea
                          value={newBlockBody}
                          onChange={(e) => setNewBlockBody(e.target.value)}
                          placeholder="Treść modułu, ćwiczenia, notatki (opcjonalnie)..."
                          rows={3}
                          className="w-full p-3 bg-base-200 border border-white/15 rounded-xl text-white text-xs font-mono focus:border-primary focus:outline-none"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowAddBlockModal(false)}
                            className="px-3.5 py-1.5 rounded-xl bg-white/10 text-content-muted hover:text-white text-xs font-semibold cursor-pointer"
                          >
                            Anuluj
                          </button>
                          <button
                            type="submit"
                            disabled={!newBlockTitle.trim()}
                            className="px-4 py-1.5 rounded-xl bg-primary text-accent-ink font-extrabold text-xs disabled:opacity-40 hover:brightness-110 shadow-sm cursor-pointer"
                          >
                            Dodaj do scenariusza
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddBlockModal(true)}
                      className="w-full py-3 rounded-2xl border border-dashed border-white/20 hover:border-primary/60 text-content-muted hover:text-primary text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-primary/5 cursor-pointer shadow-sm"
                    >
                      <Plus size={15} />
                      <span>Dodaj moduł do tego scenariusza</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonScenarioAccordion;
