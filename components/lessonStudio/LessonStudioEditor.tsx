import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Sliders, 
  Compass, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Eye, 
  Users, 
  MessageSquare,
  Play,
  Save,
  HelpCircle,
  FileText,
  Clock,
  BookOpen,
  Send
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, LessonBlock, PersonalizationSettings } from '../../types';
import Button from '../ui/Button';

interface LessonStudioEditorProps {
  initialStudentId?: string | null;
  lessonInstanceId?: string | null;
  mode?: 'new' | 'edit' | 'live';
}

const DEFAULT_BLOCKS: LessonBlock[] = [
  {
    id: 'block_checkin',
    type: 'check_in',
    title: '1. Check-in & Warm-up',
    audience: 'both',
    interactionMode: 'collaborate',
    locked: false,
    baseContent: {
      description: 'Quick informal conversation and mood check to set a positive tone.',
      prompts: [
        'How did your week go?',
        'Any unexpected English moments recently?',
        'What is your main energy level today (1-10)?'
      ]
    },
    personalizableSlots: [
      {
        slotId: 'warmup_topic',
        name: 'Warm-up topic context',
        type: 'choice',
        defaultValue: 'Recent weekend highlights',
        customValue: 'Work presentation debrief'
      }
    ]
  },
  {
    id: 'block_mission_briefing',
    type: 'mission_briefing',
    title: '2. Mission Briefing & Target Vocabulary',
    audience: 'both',
    interactionMode: 'view',
    locked: false,
    baseContent: {
      description: 'Define the clear communicative outcome and core lexical chunks for this session.',
      targetVocab: ['tackle a bottleneck', 'bring up an issue', 'streamline workflow', 'get buy-in'],
      grammarFocus: 'Diplomatic language & modal hedging (e.g., "Could we perhaps...")'
    },
    personalizableSlots: [
      {
        slotId: 'domain_scenario',
        name: 'Industry focus',
        type: 'text',
        defaultValue: 'General Business',
        customValue: 'Tech & Engineering Leadership'
      }
    ]
  },
  {
    id: 'block_final_mission',
    type: 'final_mission',
    title: '3. Final Mission (Simulation & Production)',
    audience: 'both',
    interactionMode: 'student_response',
    locked: false,
    baseContent: {
      description: 'Real-world simulation where the student applies all target phrases under realistic constraints.',
      instructions: 'Roleplay: Deliver an unscripted pitch / proposal to an executive stakeholder addressing project timeline adjustments.'
    },
    personalizableSlots: [
      {
        slotId: 'simulation_role',
        name: 'Simulation partner role',
        type: 'text',
        defaultValue: 'Client or Stakeholder',
        customValue: 'C-level Executive'
      }
    ]
  }
];

export const LessonStudioEditor: React.FC<LessonStudioEditorProps> = ({
  initialStudentId,
  lessonInstanceId,
  mode = 'new'
}) => {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(initialStudentId || null);
  const [student, setStudent] = useState<User | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Studio Settings
  const [contextMode, setContextMode] = useState<'auto' | 'work' | 'life' | 'custom'>('auto');
  const [focusArea, setFocusArea] = useState<'speaking' | 'grammar' | 'vocabulary' | 'fluency' | 'accuracy' | 'pronunciation'>('speaking');
  const [depthLevel, setDepthLevel] = useState<'fast' | 'standard' | 'deep_dive'>('standard');
  const [isPersonalizing, setIsPersonalizing] = useState(false);

  // Block State
  const [blocks, setBlocks] = useState<LessonBlock[]>(DEFAULT_BLOCKS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(DEFAULT_BLOCKS[0].id);

  useEffect(() => {
    if (!studentId && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sId = params.get('studentId') || params.get('student');
      if (sId) {
        setStudentId(sId);
      }
    }
  }, []);

  useEffect(() => {
    if (!studentId) return;
    const fetchStudent = async () => {
      setLoadingStudent(true);
      try {
        const snap = await getDoc(doc(db, 'users', studentId));
        if (snap.exists()) {
          setStudent({ id: snap.id, ...snap.data() } as User);
        }
      } catch (err) {
        console.error('[LessonStudioEditor] Error loading student:', err);
      } finally {
        setLoadingStudent(false);
      }
    };
    fetchStudent();
  }, [studentId]);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || blocks[0];
  const studentDisplayName = student 
    ? (`${student.firstName || ''} ${student.lastName || ''}`.trim() || student.displayName || student.username)
    : (studentId ? `Kursant (${studentId.slice(0, 6)}…)` : 'Wszyscy kursanci (Szablon)');

  const handlePersonalizeSimulation = () => {
    setIsPersonalizing(true);
    setTimeout(() => {
      setIsPersonalizing(false);
    }, 900);
  };

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }
  };

  return (
    <div className="min-h-screen bg-base-100 text-content flex flex-col font-sans selection:bg-primary/30">
      {/* ── TOP HEADER / CONTROLS (Glassmorphic Bar) ── */}
      <header className="sticky top-0 z-30 border-b border-line-strong bg-base-200/80 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Left: Back + Student Identity Badge */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="p-2 rounded-xl border border-line-strong bg-base-100/70 hover:bg-base-100 text-content-muted hover:text-text-hi transition-colors cursor-pointer shrink-0"
              title="Wróć"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="min-w-0 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                ⚡️
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                    Lesson Studio MVP
                  </span>
                  {mode === 'live' && (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                      Live Mode
                    </span>
                  )}
                </div>
                <h1 className="text-sm sm:text-base font-extrabold text-text-hi truncate">
                  {studentDisplayName}
                  {student?.level && (
                    <span className="ml-2 font-mono text-xs text-primary font-bold">
                      [{student.level}]
                    </span>
                  )}
                </h1>
              </div>
            </div>
          </div>

          {/* Center/Right: Studio Personalization Controls */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Context Select */}
            <div className="flex items-center gap-1.5 bg-base-100/80 border border-line-strong rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
              <span className="text-content-muted font-medium text-[11px] hidden sm:inline">Kontekst:</span>
              <select
                value={contextMode}
                onChange={(e) => setContextMode(e.target.value as any)}
                className="bg-transparent text-text-hi font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="auto">Auto (Profil AI)</option>
                <option value="work">Work / Business</option>
                <option value="life">Life / Casual</option>
                <option value="custom">Custom Brief</option>
              </select>
            </div>

            {/* Focus Select */}
            <div className="flex items-center gap-1.5 bg-base-100/80 border border-line-strong rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
              <span className="text-content-muted font-medium text-[11px] hidden sm:inline">Focus:</span>
              <select
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value as any)}
                className="bg-transparent text-text-hi font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="speaking">Speaking & Fluency</option>
                <option value="grammar">Grammar & Accuracy</option>
                <option value="vocabulary">Vocab & Idioms</option>
                <option value="pronunciation">Pronunciation</option>
              </select>
            </div>

            {/* Depth Select */}
            <div className="flex items-center gap-1.5 bg-base-100/80 border border-line-strong rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
              <span className="text-content-muted font-medium text-[11px] hidden sm:inline">Głębia:</span>
              <select
                value={depthLevel}
                onChange={(e) => setDepthLevel(e.target.value as any)}
                className="bg-transparent text-text-hi font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="fast">Fast (30 min)</option>
                <option value="standard">Standard (45-60 min)</option>
                <option value="deep_dive">Deep Dive (90 min)</option>
              </select>
            </div>

            {/* AI Personalize Action */}
            <button
              onClick={handlePersonalizeSimulation}
              disabled={isPersonalizing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-focus hover:from-primary-focus hover:to-primary text-accent-ink font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={14} className={isPersonalizing ? 'animate-spin' : ''} />
              <span>{isPersonalizing ? 'Dostosowywanie…' : '✨ Personalize'}</span>
            </button>

            {/* Start Live Session Button */}
            <button
              onClick={() => {
                alert('Moduł sesji Live dla Lesson Studio zostanie podłączony w kolejnym etapie.');
              }}
              className="px-3.5 py-2 rounded-xl border border-line-strong bg-base-100/80 hover:bg-base-100 text-content-muted hover:text-text-hi text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Uruchom sesję na żywo"
            >
              <Play size={13} className="text-primary" />
              <span className="hidden sm:inline">Prowadź Live</span>
            </button>
          </div>

        </div>
      </header>

      {/* ── MAIN STUDIO WORKSPACE (2-Column Layout) ── */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── LEFT COLUMN: Lesson Structure & Blocks (5 cols) ── */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-primary" />
              <h2 className="text-sm font-extrabold text-text-hi uppercase tracking-wider">
                Struktura Lekcji 1
              </h2>
            </div>
            <span className="text-xs font-mono text-content-muted">
              {blocks.length} bloki
            </span>
          </div>

          <div className="space-y-3">
            {blocks.map((block, index) => {
              const isSelected = block.id === selectedBlockId;
              return (
                <div
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
                    isSelected
                      ? 'border-primary/80 bg-gradient-to-r from-primary/15 via-base-200/90 to-base-200 shadow-md ring-1 ring-primary/30'
                      : 'border-line-strong bg-base-200/60 hover:border-line-soft hover:bg-base-200/80 text-content'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                          isSelected ? 'bg-primary/25 text-primary' : 'bg-base-100 text-content-muted'
                        }`}>
                          Krok {index + 1}
                        </span>
                        <span className="text-xs font-mono uppercase text-content-muted">
                          {block.interactionMode}
                        </span>
                      </div>
                      <h3 className={`text-sm font-bold truncate ${isSelected ? 'text-text-hi' : 'text-content'}`}>
                        {block.title}
                      </h3>
                      {block.baseContent.description && (
                        <p className="text-xs text-content-muted line-clamp-2 mt-1 leading-relaxed">
                          {block.baseContent.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-content-muted flex items-center gap-1">
                      {block.locked ? (
                        <Lock size={14} className="text-amber-400/80" />
                      ) : (
                        <Unlock size={14} className="opacity-40" />
                      )}
                    </div>
                  </div>

                  {/* Personalizable slots badges */}
                  {block.personalizableSlots.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-line-strong/60 flex flex-wrap gap-1.5">
                      {block.personalizableSlots.map(slot => (
                        <span
                          key={slot.slotId}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-base-100/70 text-content-muted border border-line-strong flex items-center gap-1"
                        >
                          <Sparkles size={9} className="text-primary" />
                          <span>{slot.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── RIGHT COLUMN: Block Inspector & Live Preview (7 cols) ── */}
        <section className="lg:col-span-7">
          <div className="rounded-3xl border border-line-strong bg-base-200/70 p-6 sm:p-7 shadow-ambient backdrop-blur-xl space-y-6">
            
            {/* Inspector Header */}
            <div className="flex items-center justify-between pb-4 border-b border-line-strong">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                    Inspektor Bloku
                  </span>
                  <span className="text-xs font-mono text-content-muted">
                    ID: {selectedBlock.id}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-text-hi">
                  {selectedBlock.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBlocks(prev => prev.map(b => b.id === selectedBlock.id ? { ...b, locked: !b.locked } : b));
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    selectedBlock.locked 
                      ? 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                      : 'border-line-strong bg-base-100 text-content-muted hover:text-text-hi'
                  }`}
                  title={selectedBlock.locked ? 'Odblokuj edycję' : 'Zablokuj blok'}
                >
                  {selectedBlock.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  <span className="hidden sm:inline">{selectedBlock.locked ? 'Zablokowany' : 'Odblokowany'}</span>
                </button>
              </div>
            </div>

            {/* Block Details / Content Display */}
            <div className="space-y-5">
              
              {/* Description */}
              {selectedBlock.baseContent.description && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted">
                    Cel i opis etapu:
                  </label>
                  <div className="p-3.5 rounded-xl bg-base-100/60 border border-line-strong text-xs text-text-hi leading-relaxed">
                    {selectedBlock.baseContent.description}
                  </div>
                </div>
              )}

              {/* Prompts or Instructions */}
              {selectedBlock.baseContent.prompts && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted">
                    Pytania wprowadzające / Prompty:
                  </label>
                  <ul className="space-y-2">
                    {selectedBlock.baseContent.prompts.map((prompt: string, idx: number) => (
                      <li key={idx} className="p-3 rounded-xl bg-base-100/50 border border-line-strong text-xs text-text-hi flex items-start gap-2.5">
                        <span className="text-primary font-bold">#{idx + 1}</span>
                        <span>{prompt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Target Vocab & Grammar */}
              {(selectedBlock.baseContent.targetVocab || selectedBlock.baseContent.grammarFocus) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedBlock.baseContent.targetVocab && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted">
                        Docelowe słownictwo:
                      </label>
                      <div className="p-3 rounded-xl bg-base-100/60 border border-line-strong flex flex-wrap gap-1.5">
                        {selectedBlock.baseContent.targetVocab.map((vocab: string, i: number) => (
                          <span key={i} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                            {vocab}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBlock.baseContent.grammarFocus && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted">
                        Struktury gramatyczne:
                      </label>
                      <div className="p-3 rounded-xl bg-base-100/60 border border-line-strong text-xs font-medium text-text-hi">
                        {selectedBlock.baseContent.grammarFocus}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Simulation Instructions */}
              {selectedBlock.baseContent.instructions && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted">
                    Scenariusz misji finałowej:
                  </label>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/25 text-xs text-text-hi leading-relaxed">
                    {selectedBlock.baseContent.instructions}
                  </div>
                </div>
              )}

              {/* Personalizable Slots Section */}
              <div className="pt-3 border-t border-line-strong/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-hi flex items-center gap-1.5">
                    <Sparkles size={13} className="text-primary" />
                    <span>Personalizowane Sloty (Dla tego kursanta)</span>
                  </h3>
                  <span className="text-[11px] text-content-muted">
                    Dostosowane do profilu
                  </span>
                </div>

                {selectedBlock.personalizableSlots.length === 0 ? (
                  <div className="p-4 rounded-xl bg-base-100/40 border border-line-strong text-center text-xs text-content-muted">
                    Ten blok nie wymaga specyficznych slotów personalizacji.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedBlock.personalizableSlots.map(slot => (
                      <div key={slot.slotId} className="p-3.5 rounded-xl bg-base-100/70 border border-line-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-text-hi block">
                            {slot.name}
                          </span>
                          <span className="text-[11px] text-content-muted block">
                            Wartość bazowa: {String(slot.defaultValue)}
                          </span>
                        </div>
                        <div className="sm:max-w-xs w-full">
                          <input
                            type="text"
                            defaultValue={slot.customValue || slot.defaultValue}
                            className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg bg-base-200 border border-line-strong focus:border-primary text-text-hi focus:outline-none"
                            placeholder="Wpisz niestandardową wartość…"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        </section>

      </main>
    </div>
  );
};

export default LessonStudioEditor;
