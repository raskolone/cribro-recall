import React, { useState, useRef } from 'react';
import {
  Airplay,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  Plus,
  Sparkles,
  X,
  Volume2,
  Music,
  UploadCloud,
  Layers,
  ListOrdered,
  FileText,
  RotateCcw,
  Zap,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { PresentationState } from './ScratchpadPresentationOverlay';
import Button from '../ui/Button';
import { runCouncil, SCRATCHPAD_REVIEW_SYSTEM } from '../../services/aiCouncil';
import { FlipCardItem, ProcessStepItem } from '../presentation/InteractiveSlideDeck';

interface ScratchpadLivePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPresentation: (presentation: PresentationState) => void;
}

const PRESET_ACTIVITIES: Array<{
  title: string;
  type: PresentationState['type'];
  question?: string;
  prompt?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioName?: string;
  hints: string[];
  cards?: FlipCardItem[];
  steps?: ProcessStepItem[];
  options?: string[];
  correctAnswer?: string | number;
  explanation?: string;
}> = [
  {
    title: '🎴 Interaktywne Fiszki 3D (Flip Cards E-Learning)',
    type: 'flip_cards',
    question: 'Obracaj karty, aby poznać kluczowe zwroty w kontekście.',
    prompt: 'Dotknij karty, aby sprawdzić znaczenie, wymowę i autentyczne zdanie przykładowe.',
    hints: ['Tap to flip...', 'Repeat out loud...', 'Use in a sentence...'],
    cards: [
      {
        term: 'Leverage synergy',
        definition: 'Wykorzystać synergię / połączyć siły dla lepszego rezultatu',
        example: 'By merging our teams, we can leverage synergy to deliver the project twice as fast.',
        hint: 'Biznesowy czasownik oznaczający efektywne wykorzystanie zasobów',
      },
      {
        term: 'Double-edged sword',
        definition: 'Broń obosieczna / rozwiązanie niosące zarówno korzyści, jak i ryzyka',
        example: 'Rapid AI adoption is a double-edged sword: it boosts speed but requires strict oversight.',
        hint: 'Popularny idiom opisujący niejednoznaczne zjawiska',
      },
      {
        term: 'Streamline operations',
        definition: 'Usprawnić i zoptymalizować procesy operacyjne',
        example: 'Our primary goal this quarter is to streamline operations and eliminate bottlenecks.',
        hint: 'Często używane w kontekście optymalizacji pracy i automatyzacji',
      },
      {
        term: 'Radical candour',
        definition: 'Radykalna szczerość / bezpośredni, ale życzliwy feedback',
        example: 'Practicing radical candour helps build trust without sugarcoating important issues.',
        hint: 'Koncepcja otwartej i konstruktywnej komunikacji w zespole',
      },
    ],
  },
  {
    title: '📋 Sekcje i Kroki Lekcji (Interactive Process Steps)',
    type: 'process_tabs',
    question: 'Przechodź krok po kroku przez strukturę zagadnienia.',
    prompt: 'Interaktywny moduł w stylu Articulate 360: analiza studium przypadku i argumentacji.',
    hints: ['Review each step...', 'Synthesize arguments...', 'Prepare concluding remarks...'],
    steps: [
      {
        title: 'Krok 1: Wprowadzenie i Diagnoza',
        subtitle: 'Context & Problem Statement',
        content: 'Klient stoi przed wyzwaniem spadku zaangażowania użytkowników o 15% po ostatniej aktualizacji platformy. Zespół musi zidentyfikować przyczyny i zaproponować plan naprawczy.',
        keyPoints: ['Spadek wskaźnika retencji w kluczowym segmencie', 'Brak intuicyjnej nawigacji w nowym interfejsie', 'Wymóg szybkiej reakcji w ciągu 48h'],
      },
      {
        title: 'Krok 2: Burza Mózgów i Opcje',
        subtitle: 'Proposed Interventions',
        content: 'Dyskutujemy trzy możliwe ścieżki: szybki rollback, wdrożenie przewodnika onboardingowego (coach marks) lub bezpośrednie webinary wsparcia dla klientów.',
        keyPoints: ['Opcja A: Rollback (bezpieczna, lecz kosztowna wizerunkowo)', 'Opcja B: Interactive Onboarding (rekomendowana)', 'Opcja C: Direct Consultations'],
      },
      {
        title: 'Krok 3: Decyzja i Plan Wdrożenia',
        subtitle: 'Actionable Execution Plan',
        content: 'Formułujemy ostateczną rekomendację w języku angielskim z użyciem zaawansowanych struktur warunkowych i czasowników modalnych.',
        keyPoints: ['Przygotowanie executive summary dla zarządu', 'Wdrożenie mikro-samouczków', 'Pomiar efektów po 7 dniach'],
      },
    ],
  },
  {
    title: '🎧 Słuchanie & Audio (Listening comprehension)',
    type: 'listening',
    question: 'Odsłuchaj nagranie i wynotuj kluczowe argumenty.',
    prompt: 'Zwróć uwagę na ton wypowiedzi mówcy, użyte kolokacje oraz kluczowe wnioski.',
    hints: ['Focus on the main idea first...', 'Note down specific keywords...', 'Listen for transition words (however, furthermore)...'],
  },
  {
    title: '🎡 Koło Fortuny (Warm-up Wheel / Rozgrzewka)',
    type: 'wheel_of_fortune',
    question: 'Zakręć kołem i wylosuj pytanie rozgrzewkowe na start lekcji.',
    prompt: 'Interaktywne koło pytań rozgrzewkowych z fizyką GSAP. Wybierz źródło pytań (scenariusz lub historia lekcji) i wylosuj temat do swobodnej rozmowy.',
    hints: ['Give a concrete example from your work...', 'From my perspective...', 'If I had to choose...', 'In my day-to-day routine...'],
  },
  {
    title: '📸 Opisanie obrazka (Describe the picture)',
    type: 'image_prompt',
    question: 'Describe what you see in the image and compare with your experience.',
    prompt: 'Use prepositions of place (in the foreground, on the left, background), describe actions using Present Continuous, and speculate about what happened before or what will happen next.',
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    hints: ['In the foreground...', 'It looks like...', 'They might be discussing...', 'On the one hand...', 'I get the impression that...'],
  },
  {
    title: '💬 Pytanie dyskusyjne (Discussion prompt)',
    type: 'slide',
    question: 'How has remote work transformed team communication in your industry?',
    prompt: 'Discuss advantages, drawbacks, and the impact of asynchronous communication tools on productivity and relationships.',
    hints: ['From my perspective...', 'A double-edged sword...', 'Streamlining workflows...', 'Maintaining cohesion...', 'Burnout risks...'],
  },
  {
    title: '🎯 Szybkie wyzwanie językowe (Quick challenge)',
    type: 'scenario_item',
    question: 'Rephrase using advanced vocabulary and conditionals.',
    prompt: 'Express the following idea without using the words "good", "bad", or "important": "If we don’t fix this problem now, we will lose a lot of clients."',
    hints: ['Had we not addressed...', 'Unless we mitigate...', 'Critical juncture...', 'Client retention...', 'Detrimental impact...'],
  },
];

export const ScratchpadLivePresentationModal: React.FC<ScratchpadLivePresentationModalProps> = ({
  isOpen,
  onClose,
  onStartPresentation,
}) => {
  useEscapeModal(isOpen, onClose);

  const [activeTab, setActiveTab] = useState<'presets' | 'quick_paste' | 'custom'>('presets');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  // Stan dla Quick Paste
  const [quickPasteText, setQuickPasteText] = useState('');
  const [quickPasteType, setQuickPasteType] = useState<'discussion' | 'flip_cards' | 'quiz' | 'process'>('discussion');
  const [isProcessingAi, setIsProcessingAi] = useState(false);

  // Stan dla Custom
  const [customTitle, setCustomTitle] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [customAudioUrl, setCustomAudioUrl] = useState('');
  const [customAudioName, setCustomAudioName] = useState('');
  const [customHints, setCustomHints] = useState('');
  const audioInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLaunchPreset = (idx: number) => {
    const preset = PRESET_ACTIVITIES[idx];
    onStartPresentation({
      active: true,
      ...preset,
      audioUrl: customAudioUrl.trim() || preset.audioUrl,
      audioName: customAudioName.trim() || preset.audioName,
    });
    onClose();
  };

  const handleLaunchCustom = () => {
    if (!customQuestion.trim() && !customTitle.trim()) return;
    onStartPresentation({
      active: true,
      title: customTitle.trim() || (customAudioUrl ? 'Słuchanie & Audio' : 'Prezentacja z notatnika'),
      type: customAudioUrl ? 'listening' : customImageUrl ? 'image_prompt' : 'slide',
      question: customQuestion.trim(),
      prompt: customPrompt.trim(),
      imageUrl: customImageUrl.trim() || undefined,
      audioUrl: customAudioUrl.trim() || undefined,
      audioName: customAudioName.trim() || undefined,
      hints: customHints.split(',').map((h) => h.trim()).filter(Boolean),
    });
    onClose();
  };

  const handleQuickPasteProcess = async () => {
    if (!quickPasteText.trim()) return;
    setIsProcessingAi(true);

    try {
      if (quickPasteType === 'flip_cards') {
        // Generowanie fiszek 3D z tekstu
        const lines = quickPasteText.split('\n').filter(Boolean);
        const cards: FlipCardItem[] = lines.map((l) => {
          if (l.includes(' - ') || l.includes(' – ') || l.includes(':')) {
            const parts = l.split(/\s*[-–:]\s*/);
            return {
              term: parts[0].trim(),
              definition: parts.slice(1).join(' – ').trim(),
              example: `We should consider ${parts[0].trim().toLowerCase()} in our daily communication.`,
            };
          }
          return {
            term: l.trim(),
            definition: 'Kluczowe pojęcie do omówienia',
            example: `Let's discuss how "${l.trim()}" applies to our context.`,
          };
        });

        onStartPresentation({
          active: true,
          title: '🎴 Interaktywne Fiszki Słówek',
          type: 'flip_cards',
          question: 'Obracaj karty, aby przećwiczyć nowe słownictwo.',
          prompt: 'Dotknij karty, aby sprawdzić polskie znaczenie i zdanie przykładowe.',
          cards: cards.slice(0, 8),
          hints: ['Repeat after the teacher...', 'Make your own sentence...'],
        });
        onClose();
      } else if (quickPasteType === 'process') {
        const lines = quickPasteText.split('\n').filter(Boolean);
        const steps: ProcessStepItem[] = lines.map((l, i) => ({
          title: `Etap ${i + 1}: ${l.slice(0, 45)}`,
          content: l,
          keyPoints: ['Przeanalizuj założenia', 'Sformułuj odpowiedź po angielsku'],
        }));

        onStartPresentation({
          active: true,
          title: '📋 Sekcje Procesu / Zagadnienia',
          type: 'process_tabs',
          question: 'Przechodź krok po kroku przez kolejne etapy.',
          prompt: 'Interaktywna prezentacja etapów zadania.',
          steps: steps.slice(0, 5),
          hints: ['Next step...', 'Synthesize...'],
        });
        onClose();
      } else {
        // Dyskusja lub pojedynczy slajd
        const lines = quickPasteText.split('\n').filter(Boolean);
        const question = lines[0] || 'Dyskusja na żywo';
        const prompt = lines.slice(1).join('\n') || 'Przeanalizuj powyższe zagadnienie i przedstaw swoje stanowisko.';

        onStartPresentation({
          active: true,
          title: '💬 Dyskusja & Pytania',
          type: 'slide',
          question,
          prompt,
          hints: ['From my perspective...', 'On the other hand...', 'In my experience...'],
        });
        onClose();
      }
    } catch (err) {
      console.warn('[QuickPaste Error]:', err);
    } finally {
      setIsProcessingAi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="presentation-modal-title"
        className="relative w-full max-w-3xl bg-base-200 border border-primary/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line-strong bg-base-300/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(114,240,180,0.2)]">
              <Airplay size={22} />
            </div>
            <div>
              <h3 id="presentation-modal-title" className="text-base sm:text-lg font-bold text-text-hi">
                Centrum Prezentacji & E-Learningu Notatnika
              </h3>
              <p className="text-xs text-content-muted">
                Uruchom interaktywny slajd, fiszki 3D, audio lub wklej treść dla kursanta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-2 bg-base-300/40 border-b border-line-soft">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-primary text-ink-base shadow-sm font-bold'
                : 'text-content-muted hover:text-text-hi hover:bg-white/5'
            }`}
          >
            <Sparkles size={14} /> Gotowe Wzorce Aktywności
          </button>
          <button
            onClick={() => setActiveTab('quick_paste')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'quick_paste'
                ? 'bg-primary text-ink-base shadow-sm font-bold'
                : 'text-content-muted hover:text-text-hi hover:bg-white/5'
            }`}
          >
            <Zap size={14} /> Szybki Wklejacz Treści (AI)
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'custom'
                ? 'bg-primary text-ink-base shadow-sm font-bold'
                : 'text-content-muted hover:text-text-hi hover:bg-white/5'
            }`}
          >
            <FileText size={14} /> Własny Slajd / Audio
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* TAB 1: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                Wybierz aktywność do wyświetlenia kursantowi:
              </div>
              <div className="grid grid-cols-1 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {PRESET_ACTIVITIES.map((act, idx) => {
                  const isSelected = selectedPresetIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedPresetIndex(idx)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-primary/15 border-primary shadow-lg ring-1 ring-primary/40'
                          : 'bg-base-300/40 border-line-soft hover:border-line-strong hover:bg-base-300/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm sm:text-base text-text-hi">
                          {act.title}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-content-muted">
                          {act.type}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-primary line-clamp-1">
                        {act.question}
                      </p>
                      <p className="text-xs text-content-muted line-clamp-2">
                        {act.prompt}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Szybki start zaznaczonego wzorca */}
              <div className="pt-3 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => handleLaunchPreset(selectedPresetIndex)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg shadow-primary/20 font-bold"
                >
                  <Airplay size={16} /> Uruchom ten slajd dla kursanta
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: QUICK PASTE */}
          {activeTab === 'quick_paste' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-text-hi leading-relaxed flex items-start gap-2.5">
                <Sparkles size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Szybkie tworzenie slajdów:</strong> Wklej poniżej kilka zdań do dyskusji, listę słówek (np. <code>term - definition</code>) lub punkty lekcji. System błyskawicznie przekształci je w interaktywny slajd dla kursanta.
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-hi mb-1.5 block">
                  Wybierz format prezentacji:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickPasteType('discussion')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      quickPasteType === 'discussion'
                        ? 'bg-primary text-ink-base border-primary font-bold'
                        : 'bg-base-300/40 border-line-soft text-content-muted hover:text-text-hi'
                    }`}
                  >
                    <MessageSquare size={14} /> Temat dyskusji
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickPasteType('flip_cards')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      quickPasteType === 'flip_cards'
                        ? 'bg-primary text-ink-base border-primary font-bold'
                        : 'bg-base-300/40 border-line-soft text-content-muted hover:text-text-hi'
                    }`}
                  >
                    <RotateCcw size={14} /> Fiszki 3D (Słówka)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickPasteType('process')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      quickPasteType === 'process'
                        ? 'bg-primary text-ink-base border-primary font-bold'
                        : 'bg-base-300/40 border-line-soft text-content-muted hover:text-text-hi'
                    }`}
                  >
                    <ListOrdered size={14} /> Kroki procesu
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-hi mb-1.5 block">
                  Wklej treść (zdania lub lista haseł):
                </label>
                <textarea
                  value={quickPasteText}
                  onChange={(e) => setQuickPasteText(e.target.value)}
                  placeholder={
                    quickPasteType === 'flip_cards'
                      ? 'Leverage synergy - Wykorzystać synergię\nDouble-edged sword - Broń obosieczna\nStreamline operations - Usprawnić procesy'
                      : 'How has remote work transformed team communication?\nDiscuss advantages, drawbacks, and async tools.'
                  }
                  rows={6}
                  className="w-full p-3.5 rounded-2xl bg-base-300 border border-line-strong text-text-hi text-sm focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="primary"
                  onClick={handleQuickPasteProcess}
                  disabled={!quickPasteText.trim() || isProcessingAi}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 font-bold"
                >
                  {isProcessingAi ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Przetwarzanie...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Przekształć i uruchom dla kursanta
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-hi mb-1 block">
                  Tytuł aktywności
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="np. Ćwiczenie ze słuchu / Pytanie do debaty"
                  className="w-full p-3 rounded-xl bg-base-300 border border-line-strong text-text-hi text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-hi mb-1 block">
                  Pytanie główne / Nagłówek dla kursanta
                </label>
                <textarea
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="np. Odsłuchaj nagranie i wynotuj 3 kluczowe argumenty"
                  rows={2}
                  className="w-full p-3 rounded-xl bg-base-300 border border-line-strong text-text-hi text-sm focus:outline-none focus:border-primary font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-hi mb-1 block">
                  Instrukcja / Prompt pomocniczy
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Zwróć uwagę na intonację mówcy i użyte konstrukcje gramatyczne..."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-base-300 border border-line-strong text-text-hi text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {/* Audio URL & Upload */}
              <div className="p-4 rounded-2xl bg-base-300/60 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Music size={15} /> Plik Audio lub Strumień URL
                  </span>
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="text-xs text-purple-300 hover:text-white flex items-center gap-1 bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/40 cursor-pointer"
                  >
                    <UploadCloud size={13} /> Wgraj plik (.mp3, .wav)
                  </button>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => {
                          setCustomAudioUrl(re.target?.result as string);
                          setCustomAudioName(file.name);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
                <input
                  type="url"
                  value={customAudioUrl.startsWith('data:') ? '' : customAudioUrl}
                  onChange={(e) => {
                    setCustomAudioUrl(e.target.value);
                    setCustomAudioName(e.target.value.split('/').pop() || 'Strumień audio');
                  }}
                  placeholder="https://example.com/audio-stream.mp3"
                  className="w-full p-2.5 rounded-xl bg-base-200 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-purple-400"
                />
                {customAudioUrl && (
                  <audio controls src={customAudioUrl} className="w-full h-8 rounded-lg mt-2" />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="primary"
                  onClick={handleLaunchCustom}
                  disabled={!customQuestion.trim() && !customTitle.trim()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 font-bold"
                >
                  <Airplay size={16} /> Uruchom dla kursanta
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScratchpadLivePresentationModal;
