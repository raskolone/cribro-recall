import React, { useState } from 'react';
import { Airplay, Image as ImageIcon, Lightbulb, MessageSquare, Plus, Sparkles, X } from 'lucide-react';
import { useEscapeModal } from '../../hooks/useEscapeModal';
import { PresentationState } from './ScratchpadPresentationOverlay';
import Button from '../ui/Button';

interface ScratchpadLivePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartPresentation: (presentation: PresentationState) => void;
}

const PRESET_ACTIVITIES: Array<{
  title: string;
  type: 'image_prompt' | 'slide' | 'scenario_item';
  question: string;
  prompt: string;
  imageUrl?: string;
  hints: string[];
}> = [
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

  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [customTitle, setCustomTitle] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [customHints, setCustomHints] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  if (!isOpen) return null;

  const handleLaunch = () => {
    if (isCustom) {
      if (!customQuestion.trim() && !customTitle.trim()) return;
      onStartPresentation({
        active: true,
        title: customTitle.trim() || 'Prezentacja z notatnika',
        type: customImageUrl ? 'image_prompt' : 'slide',
        question: customQuestion.trim(),
        prompt: customPrompt.trim(),
        imageUrl: customImageUrl.trim() || undefined,
        hints: customHints.split(',').map((h) => h.trim()).filter(Boolean),
      });
    } else {
      const preset = PRESET_ACTIVITIES[selectedPresetIndex];
      onStartPresentation({
        active: true,
        ...preset,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="presentation-modal-title"
        className="relative w-full max-w-2xl bg-base-200 border border-primary/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line-strong bg-base-300/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Airplay size={20} />
            </div>
            <div>
              <h3 id="presentation-modal-title" className="text-base sm:text-lg font-bold text-text-hi">
                Uruchom tryb prezentacji w notatniku (Prototyp)
              </h3>
              <p className="text-xs text-content-muted">
                Wybrany slajd lub ćwiczenie pojawi się na ekranie kursanta zamiast notatnika
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

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          <div className="flex items-center gap-2 p-1 bg-base-300 rounded-xl border border-line-strong">
            <button
              type="button"
              onClick={() => setIsCustom(false)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                !isCustom ? 'bg-primary text-accent-ink shadow-sm' : 'text-content-muted hover:text-text-hi'
              }`}
            >
              Gotowe wzorce aktywności
            </button>
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                isCustom ? 'bg-primary text-accent-ink shadow-sm' : 'text-content-muted hover:text-text-hi'
              }`}
            >
              Własny slajd / Treść lektora
            </button>
          </div>

          {!isCustom ? (
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-content-muted">
                Wybierz aktywność dla kursanta:
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {PRESET_ACTIVITIES.map((act, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPresetIndex(idx)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedPresetIndex === idx
                        ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(114,240,180,0.15)] ring-1 ring-primary/50'
                        : 'border-line-strong bg-base-100/60 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-text-hi">{act.title}</span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-line-soft border border-line-strong text-content-muted">
                        {act.type}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-primary mt-1">{act.question}</p>
                    <p className="text-[11px] text-content-muted mt-1 line-clamp-2">{act.prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-content-muted mb-1">Tytuł slajdu:</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="np. Opisanie wykresu / Dyskusja o strategii"
                  className="w-full px-3 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-text-hi focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-content-muted mb-1">Pytanie główne / Zadanie:</label>
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="np. What are the key takeaways from this graph?"
                  className="w-full px-3 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-text-hi focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-content-muted mb-1">Opis / Instrukcja dla kursanta:</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                  placeholder="Wskazówki, polecenie lub kontekst..."
                  className="w-full px-3 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-text-hi focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-content-muted mb-1">URL obrazka (opcjonalnie):</label>
                <input
                  type="url"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-text-hi focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-content-muted mb-1">Podpowiedzi / Słówka (po przecinku):</label>
                <input
                  type="text"
                  value={customHints}
                  onChange={(e) => setCustomHints(e.target.value)}
                  placeholder="In my opinion, On the one hand, Significantly"
                  className="w-full px-3 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-text-hi focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line-strong bg-base-300/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-line-soft text-content-muted hover:text-text-hi text-xs font-bold border border-line-strong"
          >
            Anuluj
          </button>
          <Button
            size="sm"
            onClick={handleLaunch}
            className="text-xs font-bold py-2 px-5 bg-primary text-accent-ink shadow-btn flex items-center gap-1.5"
          >
            <Airplay size={14} />
            Uruchom slajd dla kursanta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ScratchpadLivePresentationModal;
