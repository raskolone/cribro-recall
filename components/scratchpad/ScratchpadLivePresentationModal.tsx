import React, { useState, useRef } from 'react';
import { Airplay, Image as ImageIcon, Lightbulb, MessageSquare, Plus, Sparkles, X, Volume2, Music, UploadCloud } from 'lucide-react';
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
  type: 'image_prompt' | 'slide' | 'scenario_item' | 'wheel_of_fortune' | 'listening';
  question: string;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  audioName?: string;
  hints: string[];
}> = [
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

  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [customTitle, setCustomTitle] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [customAudioUrl, setCustomAudioUrl] = useState('');
  const [customAudioName, setCustomAudioName] = useState('');
  const [customHints, setCustomHints] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLaunch = () => {
    if (isCustom) {
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
                <label className="block text-xs font-bold text-content-muted mb-1">
                  Plik audio / nagranie do odsłuchania (opcjonalnie):
                </label>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 15 * 1024 * 1024) {
                        alert(`Plik "${file.name}" przekracza maksymalny limit 15 MB.`);
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setCustomAudioUrl(reader.result as string);
                        setCustomAudioName(file.name);
                        if (!customTitle.trim()) {
                          setCustomTitle(`Nagranie: ${file.name}`);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <UploadCloud size={14} />
                    Wgraj audio (.mp3, .wav)
                  </button>
                  <input
                    type="url"
                    value={customAudioUrl.startsWith('data:') ? '' : customAudioUrl}
                    onChange={(e) => {
                      setCustomAudioUrl(e.target.value);
                      if (!customAudioName) setCustomAudioName('Audio z URL');
                    }}
                    placeholder={customAudioUrl.startsWith('data:') ? `Załączono: ${customAudioName}` : 'lub wklej bezpośredni link URL do audio...'}
                    className="flex-1 px-3 py-2 rounded-xl bg-base-100 border border-line-strong text-xs text-text-hi focus:border-primary focus:outline-none"
                  />
                  {customAudioUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAudioUrl('');
                        setCustomAudioName('');
                      }}
                      className="p-2 rounded-xl border border-line hover:border-rose-500/50 text-content-muted hover:text-rose-400 text-xs transition-colors cursor-pointer shrink-0"
                      title="Usuń nagranie"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {customAudioUrl && (
                  <div className="mt-2 p-2.5 rounded-xl bg-purple-950/25 border border-purple-500/30 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-200">
                      <Music size={13} className="text-purple-400 shrink-0" />
                      <span className="truncate">{customAudioName || 'Nagranie audio'}</span>
                    </div>
                    <audio controls src={customAudioUrl} className="w-full h-8 rounded-lg accent-primary" />
                  </div>
                )}
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
