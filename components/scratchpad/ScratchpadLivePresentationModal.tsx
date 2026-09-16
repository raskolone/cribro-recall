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
  Loader2,
  HelpCircle,
  CheckCircle2,
  BookOpen,
  Check,
  Award
} from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { PresentationState } from './ScratchpadPresentationOverlay';
import Button from '../ui/Button';
import { runCouncil } from '../../services/aiCouncil';
import { FlipCardItem, ProcessStepItem } from '../presentation/InteractiveSlideDeck';

interface ScratchpadLivePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPresentation: (presentation: PresentationState) => void;
}

const PRESET_TOPICS = [
  { label: 'Negocjacje & Obiekcje (B2)', topic: 'Business English: Handling Objections & Negotiating Contract Terms', level: 'B2' },
  { label: 'Small Talk & Networking (B1/B2)', topic: 'Small Talk, Networking & Building Rapport with International Clients', level: 'B2' },
  { label: 'Trendy & Wykresy (B2/C1)', topic: 'Describing Trends, Graphs & Forecasting Financial Performance', level: 'C1' },
  { label: 'Trudny Klient / Reklamacje (B2)', topic: 'De-escalating Conflict and Resolving Difficult Customer Complaints', level: 'B2' },
  { label: 'Kondycjonale & Hipotezy (B2)', topic: 'Grammar in Context: 3rd & Mixed Conditionals in Decision Making', level: 'B2' },
];

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

  const [activeTab, setActiveTab] = useState<'ai_generator' | 'presets' | 'quick_paste' | 'custom'>('ai_generator');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  // Stan dla AI Slide Deck Generator
  const [aiTopic, setAiTopic] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [aiLevel, setAiLevel] = useState('B2');
  const [aiSlideCount, setAiSlideCount] = useState(4);
  const [isGeneratingAiDeck, setIsGeneratingAiDeck] = useState(false);
  const [generatedDeck, setGeneratedDeck] = useState<{
    deckTitle: string;
    slides: Array<NonNullable<PresentationState['slides']>[number]>;
  } | null>(null);
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);

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

  const handleGenerateAiDeck = async () => {
    if (!aiTopic.trim()) return;
    setIsGeneratingAiDeck(true);
    setGeneratedDeck(null);

    try {
      const prompt = `Jesteś metodykiem języka angielskiego i ekspertem tworzenia nowoczesnych, interaktywnych slajdów e-learningowych w platformie CRIBRO Recall.
Twoim zadaniem jest wygenerować kompletną lekcję w slajdach na podany temat:

TEMAT: "${aiTopic}"
POZIOM CEFR: ${aiLevel}
LICZBA SLAJDÓW: ${aiSlideCount}
DODATKOWE MATERIAŁY/NOTATKI LEKTORA:
"${aiNotes || 'Brak dodatkowych notatek, wygeneruj na podstawie wiedzy metodycznej dla wskazanego tematu i poziomu.'}"

Zbuduj dokładnie ${aiSlideCount} zróżnicowanych metodycznie slajdów o następującej strukturze:
1. Slajd 1: Rozgrzewka i dyskusja ("type": "slide") — chwytliwe pytanie (question po angielsku), prompt do rozmowy (po polsku lub angielsku) i 4 przydatne zwroty w "hints".
2. Slajd 2: Struktura/Reguła lub Etapy procesu ("type": "process_tabs") — zawiera tablicę "steps" (2-3 etapy, każdy z title, subtitle, content i 2 keyPoints).
3. Slajd 3: Kluczowe zwroty w kontekście ("type": "flip_cards") — zawiera tablicę "cards" (3-4 karty 3D, każda z term, definition po polsku, autentycznym example po angielsku i krótkim hint).
4. Slajd 4 (jeśli >=4 slajdy): Interaktywny Quiz / Wybór scenariusza ("type": "interactive_quiz") — question, 4 opcje odpowiedzi (options), correctAnswer i merytoryczne explanation.
5. Slajd 5 (jeśli >=5 slajdów): Podsumowanie / Wyzwanie komunikacyjne ("type": "slide" lub "scenario_item") — pytanie końcowe, cel zadania i hints.

Zwróć WYŁĄCZNIE poprawny obiekt JSON o schemacie:
{
  "deckTitle": "Tytuł całej talii slajdów",
  "slides": [
    {
      "title": "Tytuł slajdu",
      "type": "slide" | "process_tabs" | "flip_cards" | "interactive_quiz" | "scenario_item",
      "question": "Główne pytanie lub polecenie po angielsku",
      "prompt": "Instrukcja lub kontekst",
      "hints": ["zwrot 1", "zwrot 2"],
      "cards": [
        { "term": "...", "definition": "...", "example": "...", "hint": "..." }
      ],
      "steps": [
        { "title": "...", "subtitle": "...", "content": "...", "keyPoints": ["...", "..."] }
      ],
      "options": ["Opcja A", "Opcja B", "Opcja C", "Opcja D"],
      "correctAnswer": "Opcja B",
      "explanation": "Wyjaśnienie dlaczego ta odpowiedź jest najlepsza..."
    }
  ]
}`;

      const res = await runCouncil<{
        deckTitle: string;
        slides: Array<NonNullable<PresentationState['slides']>[number]>;
      }>({
        prompt: prompt,
        systemInstruction: 'Jesteś czołowym metodykiem nauczania języka angielskiego w biznesie. Generujesz wyłącznie perfekcyjny, syntaktycznie poprawny JSON bez markdownowych znaczników.',
      });

      if (res && res.data && Array.isArray(res.data.slides) && res.data.slides.length > 0) {
        setGeneratedDeck(res.data);
        setPreviewSlideIdx(0);
      }
    } catch (err) {
      console.error('[AI Slide Generator Error]:', err);
    } finally {
      setIsGeneratingAiDeck(false);
    }
  };

  const handleLaunchGeneratedDeck = () => {
    if (!generatedDeck || !generatedDeck.slides.length) return;
    const firstSlide = generatedDeck.slides[0];

    onStartPresentation({
      active: true,
      title: generatedDeck.deckTitle || aiTopic || 'Lekcja w Slajdach',
      type: firstSlide.type,
      question: firstSlide.question,
      prompt: firstSlide.prompt,
      hints: firstSlide.hints,
      cards: firstSlide.cards,
      steps: firstSlide.steps,
      options: firstSlide.options,
      correctAnswer: firstSlide.correctAnswer,
      explanation: firstSlide.explanation,
      slideIndex: 0,
      totalSlides: generatedDeck.slides.length,
      slides: generatedDeck.slides,
    });
    onClose();
  };

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
        className="relative w-full max-w-4xl bg-base-200 border-2 border-primary/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line-strong bg-base-300/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(114,240,180,0.25)] shrink-0">
              <Airplay size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="presentation-modal-title" className="text-base sm:text-lg font-bold text-text-hi">
                  Centrum Prezentacji & Slajdów AI
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-extrabold">
                  Live Classroom
                </span>
              </div>
              <p className="text-xs text-content-muted">
                Generuj całe lekcje w slajdach z AI, uruchamiaj fiszki 3D lub transmituj audio z synchronizacją
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTutorialModal(true)}
              title="Samouczek i przewodnik po panelu prezentacji"
              className="p-2 rounded-xl text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <HelpCircle size={15} />
              <span className="hidden sm:inline">Samouczek</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Zamknij"
              className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-2 bg-base-300/50 border-b border-line-soft overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('ai_generator')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ai_generator'
                ? 'bg-primary text-ink-base shadow-md ring-1 ring-primary/40'
                : 'text-content-muted hover:text-text-hi hover:bg-white/5'
            }`}
          >
            <Sparkles size={15} /> Generator Slajdów AI (Lekcja)
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'presets'
                ? 'bg-primary text-ink-base shadow-md ring-1 ring-primary/40'
                : 'text-content-muted hover:text-text-hi hover:bg-white/5'
            }`}
          >
            <Layers size={15} /> Gotowe Wzorce
          </button>
          <button
            onClick={() => setActiveTab('quick_paste')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'quick_paste'
                ? 'bg-primary text-ink-base shadow-md ring-1 ring-primary/40'
                : 'text-content-muted hover:text-text-hi hover:bg-white/5'
            }`}
          >
            <Zap size={15} /> Szybki Wklejacz
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'custom'
                ? 'bg-primary text-ink-base shadow-md ring-1 ring-primary/40'
                : 'text-content-muted hover:text-text-hi hover:bg-white/5'
            }`}
          >
            <FileText size={15} /> Własny Slajd / Audio
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* ════ TAB 1: AI SLIDE DECK GENERATOR ════ */}
          {activeTab === 'ai_generator' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 text-xs text-text-hi leading-relaxed flex items-start gap-3">
                <Sparkles size={18} className="text-primary flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <strong className="text-primary block text-sm mb-0.5">Podrzuć temat i materiały — odbierz kompletną lekcję w slajdach:</strong>
                  Sztuczna inteligencja w oparciu o Naradę Modeli (AI Council) stworzy zrównoważoną metodycznie talię (Rozgrzewka, Etapy procesu, Fiszki 3D, Interaktywny Quiz i Wyzwanie komunikacyjne) z pełną synchronizacją dla kursanta.
                </div>
              </div>

              {/* Szybkie presety tematów */}
              <div>
                <label className="text-xs font-bold text-text-hi mb-1.5 block">
                  Wybierz gotowy temat lub wpisz własny:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TOPICS.map((pt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAiTopic(pt.topic);
                        setAiLevel(pt.level);
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-line-strong bg-base-300/50 hover:bg-primary/20 hover:border-primary text-content-muted hover:text-text-hi text-xs font-semibold transition-all cursor-pointer"
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Temat lekcji */}
              <div>
                <label className="text-xs font-bold text-text-hi mb-1 block">
                  Temat lekcji / Cel językowy *
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="np. Business English: Cross-cultural Negotiations & Defending Price"
                  className="w-full p-3 rounded-xl bg-base-300 border border-line-strong text-text-hi text-sm focus:outline-none focus:border-primary font-medium"
                />
              </div>

              {/* Poziom i Liczba slajdów */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-hi mb-1 block">
                    Poziom zaawansowania (CEFR)
                  </label>
                  <select
                    value={aiLevel}
                    onChange={(e) => setAiLevel(e.target.value)}
                    className="w-full p-3 rounded-xl bg-base-300 border border-line-strong text-text-hi text-sm focus:outline-none focus:border-primary font-bold cursor-pointer"
                  >
                    <option value="A2">A2 (Pre-Intermediate)</option>
                    <option value="B1">B1 (Intermediate)</option>
                    <option value="B2">B2 (Upper-Intermediate - Rekomendowany)</option>
                    <option value="C1">C1 (Advanced)</option>
                    <option value="C2">C2 (Proficiency / Executive)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-hi mb-1 block">
                    Liczba slajdów w talii
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAiSlideCount(num)}
                        className={`p-2.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                          aiSlideCount === num
                            ? 'bg-primary text-ink-base border-primary shadow-sm'
                            : 'bg-base-300/60 border-line-soft text-content-muted hover:text-text-hi'
                        }`}
                      >
                        {num} slajdy
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Materiały / Notatki */}
              <div>
                <label className="text-xs font-bold text-text-hi mb-1 block">
                  Materiały wyjściowe / Wklejony tekst / Notatki z notatnika (opcjonalne)
                </label>
                <textarea
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="Wklej artykuł, słówka z notatnika lub zagadnienia, na których AI ma oprzeć treść slajdów..."
                  rows={3}
                  className="w-full p-3.5 rounded-2xl bg-base-300 border border-line-strong text-text-hi text-xs focus:outline-none focus:border-primary font-mono"
                />
              </div>

              {/* Przycisk generowania */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="primary"
                  onClick={handleGenerateAiDeck}
                  disabled={!aiTopic.trim() || isGeneratingAiDeck}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary/25"
                >
                  {isGeneratingAiDeck ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Narada Modeli układa slajdy lekcji...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Generuj kompletną lekcję w slajdach (AI)
                    </>
                  )}
                </Button>
              </div>

              {/* Podgląd wygenerowanej talii slajdów */}
              {generatedDeck && (
                <div className="mt-4 p-4 rounded-3xl bg-base-300/80 border-2 border-primary/40 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-line-strong pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-bold">
                        Gotowa talia AI ({generatedDeck.slides.length} slajdów)
                      </span>
                      <h4 className="text-base font-extrabold text-text-hi mt-1">
                        {generatedDeck.deckTitle}
                      </h4>
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleLaunchGeneratedDeck}
                      className="flex items-center gap-2 font-bold shadow-lg shadow-primary/30"
                    >
                      <Airplay size={16} /> Uruchom dla kursanta
                    </Button>
                  </div>

                  {/* Nawigacja po podglądzie */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {generatedDeck.slides.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewSlideIdx(idx)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                          previewSlideIdx === idx
                            ? 'bg-primary text-ink-base border-primary shadow-sm'
                            : 'bg-base-200 border-line-soft text-content-muted hover:text-text-hi'
                        }`}
                      >
                        <span>#{idx + 1}</span>
                        <span>{s.title || s.type}</span>
                      </button>
                    ))}
                  </div>

                  {/* Zawartość podglądanego slajdu */}
                  {generatedDeck.slides[previewSlideIdx] && (
                    <div className="p-4 rounded-2xl bg-base-200 border border-line-soft text-left space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-primary">
                        <span>Format: {generatedDeck.slides[previewSlideIdx].type}</span>
                        <span>Slajd {previewSlideIdx + 1} z {generatedDeck.slides.length}</span>
                      </div>
                      <h5 className="text-sm font-bold text-text-hi">
                        {generatedDeck.slides[previewSlideIdx].question || generatedDeck.slides[previewSlideIdx].title}
                      </h5>
                      {generatedDeck.slides[previewSlideIdx].prompt && (
                        <p className="text-xs text-content-muted">
                          {generatedDeck.slides[previewSlideIdx].prompt}
                        </p>
                      )}
                      {generatedDeck.slides[previewSlideIdx].cards && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          {generatedDeck.slides[previewSlideIdx].cards?.map((c, cIdx) => (
                            <div key={cIdx} className="p-2.5 rounded-xl bg-base-300 text-xs border border-line-soft">
                              <span className="font-bold text-primary block">{c.term}</span>
                              <span className="text-content-muted">{c.definition}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {generatedDeck.slides[previewSlideIdx].options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          {generatedDeck.slides[previewSlideIdx].options?.map((o, oIdx) => (
                            <div key={oIdx} className="p-2 rounded-xl bg-base-300 text-xs border border-line-soft text-text-hi">
                              {String.fromCharCode(65 + oIdx)}. {o}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 2: PRESETS ════ */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                Wybierz gotowy moduł ćwiczeniowy:
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

              <div className="pt-3 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => handleLaunchPreset(selectedPresetIndex)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg shadow-primary/20 font-bold"
                >
                  <Airplay size={16} /> Uruchom ten moduł dla kursanta
                </Button>
              </div>
            </div>
          )}

          {/* ════ TAB 3: QUICK PASTE ════ */}
          {activeTab === 'quick_paste' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-text-hi leading-relaxed flex items-start gap-2.5">
                <Sparkles size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Błyskawiczne slajdy:</strong> Wklej listę słówek (np. <code>term - definition</code>), punkty do dyskusji lub etapy. System natychmiast przekształci je w interaktywne karty 3D lub slajd.
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
                  Wklej treść:
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

          {/* ════ TAB 4: CUSTOM ════ */}
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

      {/* ════ MODAL SAMOUCZKA / GUIDE MODAL ════ */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-base-200 border-2 border-primary/50 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line-strong pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center border border-primary/40 font-bold">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-text-hi">
                    Przewodnik po Centrum Prezentacji Live
                  </h4>
                  <p className="text-xs text-content-muted">
                    Jak maksymalnie wykorzystać interaktywne slajdy i synchronizację na lekcji
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTutorialModal(false)}
                className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-text-hi leading-relaxed">
              <div className="p-4 rounded-2xl bg-base-300 border border-line-soft flex items-start gap-3">
                <Sparkles size={20} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <strong className="text-primary block mb-1">1. Generator Lekcji AI (Narada Modeli)</strong>
                  Wpisz dowolny temat lub cel lekcji, wklej fragment notatek, a sztuczna inteligencja wygeneruje zestaw 3–6 slajdów: rozgrzewkę, etapy procesu, fiszki 3D ze słówkami oraz interaktywny quiz.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-base-300 border border-line-soft flex items-start gap-3">
                <RotateCcw size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-400 block mb-1">2. Fiszki 3D E-Learning</strong>
                  Interaktywne karty 3D z płynnym obrotem. Pozwalają kursantowi odgadywać hasła, odsłuchiwać wymowę i analizować autentyczne zdania przykładowe.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-base-300 border border-line-soft flex items-start gap-3">
                <Zap size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-400 block mb-1">3. Synchronizacja na Żywo & Nawigacja</strong>
                  Po uruchomieniu prezentacji kursant natychmiast widzi ten sam slajd. Kiedy zmieniasz slajd (strzałki ← / →) lub odkrywasz poprawną odpowiedź, widok kursanta aktualizuje się w czasie rzeczywistym.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-base-300 border border-line-soft flex items-start gap-3">
                <Volume2 size={20} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-purple-400 block mb-1">4. Słuchanie & Audio oraz Notatki</strong>
                  Możesz transmitować pliki MP3 lub strumienie audio, zmieniać prędkość odtwarzania (0.75x–1.5x), a także prowadzić notatki ze słuchania i wklejać je do notatnika jednym kliknięciem.
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={() => setShowTutorialModal(false)}
                className="font-bold px-6"
              >
                Rozumiem, zaczynamy!
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScratchpadLivePresentationModal;
