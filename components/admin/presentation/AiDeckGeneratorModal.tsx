import React, { useState } from 'react';
import { Sparkles, X, Wand2, Loader2, BookOpen, Layers, CheckCircle2, Cpu, Award } from 'lucide-react';
import { LessonPresentation } from '../../../types';
import { generateAIPresentationDeck } from '../../../services/presentationService';
import { OPENAI_LUNA_DISPLAY_NAME } from '../../../services/presentationGuidelines';
import Button from '../../ui/Button';

interface AiDeckGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeckGenerated: (deck: LessonPresentation) => void;
  defaultLevel?: string;
  studentName?: string | null;
  defaultThingsToImprove?: string;
  onOpenGuidelines?: () => void;
}

export const AiDeckGeneratorModal: React.FC<AiDeckGeneratorModalProps> = ({
  isOpen,
  onClose,
  onDeckGenerated,
  defaultLevel = 'B2',
  studentName,
  defaultThingsToImprove,
  onOpenGuidelines
}) => {
  if (!isOpen) return null;

  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState(defaultLevel);
  const [focusArea, setFocusArea] = useState('Konwersacje, naturalne kolokacje i interaktywne ćwiczenia');
  const [lessonStyle, setLessonStyle] = useState<'celta-standard' | 'practice-intensive' | 'business-speaking' | 'grammar-drills'>('celta-standard');
  const [thingsToImprove, setThingsToImprove] = useState(defaultThingsToImprove || '');
  const [customInstructions, setCustomInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleTopics = [
    'Job Interview & Salary Negotiation',
    'Giving Diplomatic Feedback to Colleagues',
    'IT Incident Post-Mortem & Technical Discussion',
    'Phrasal Verbs for Travel & Airport Emergencies',
    'Handling Difficult Clients & Escalations',
    'Small Talk & Networking at International Conferences'
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Wpisz temat prezentacji');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const deck = await generateAIPresentationDeck({
        topic: topic.trim(),
        level,
        studentName: studentName || undefined,
        focusArea,
        thingsToImprove: thingsToImprove.trim() || undefined,
        customInstructions: customInstructions.trim() || undefined,
        lessonStyle
      });

      onDeckGenerated(deck);
      onClose();
    } catch (err: any) {
      console.error('Error generating AI presentation:', err);
      setError(err.message || 'Wystąpił błąd podczas generowania slajdów.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-200 border border-primary/30 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(114,240,180,0.15)] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-base-300/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Generuj slajdy z OpenAI 5.6 Luna</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/20 text-primary border border-primary/30">
                  Model 5.6 Luna
                </span>
              </div>
              <p className="text-xs text-content-muted">Dydaktyczny zestaw slajdów z modułami Practice & Enclosure</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleGenerate} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* Model info banner */}
          <div className="p-3 rounded-2xl bg-base-300/90 border border-primary/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Cpu size={15} className="text-primary shrink-0" />
              <span className="text-white font-medium">
                Silnik: <strong className="text-primary">{OPENAI_LUNA_DISPLAY_NAME}</strong>
              </span>
            </div>
            {onOpenGuidelines && (
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1 shrink-0"
              >
                <Award size={13} /> Wytyczne metodyczne
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-white mb-1.5">
              Temat lekcji / prezentacji *
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="np. Project Management & Risk Communication"
              className="w-full bg-base-300 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary"
              disabled={loading}
              required
            />
          </div>

          {/* Quick topic pills */}
          <div>
            <span className="text-[11px] text-content-muted block mb-1.5 font-medium">Szybkie propozycje:</span>
            <div className="flex flex-wrap gap-1.5">
              {sampleTopics.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-lg bg-base-300 hover:bg-primary/20 hover:text-primary text-[11px] text-content-muted border border-white/5 transition-all text-left"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-content-muted mb-1">Poziom CEFR</label>
              <select
                value={level}
                onChange={e => setLevel(e.target.value)}
                className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                disabled={loading}
              >
                <option value="A1">A1 - Beginner</option>
                <option value="A2">A2 - Elementary</option>
                <option value="B1">B1 - Intermediate</option>
                <option value="B2">B2 - Upper Intermediate</option>
                <option value="C1">C1 - Advanced</option>
                <option value="C2">C2 - Proficiency</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-content-muted mb-1">Szablon Dydaktyczny</label>
              <select
                value={lessonStyle}
                onChange={e => setLessonStyle(e.target.value as any)}
                className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                disabled={loading}
              >
                <option value="celta-standard">Standard CELTA (6 slajdów: Warm-up + Practice + Enclosure)</option>
                <option value="practice-intensive">Intensywne Practice & Drills (5 slajdów)</option>
                <option value="business-speaking">Business Speaking & Scenki (5-6 slajdów)</option>
                <option value="grammar-drills">Grammar Focus & Błędy (5 slajdów)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-content-muted mb-1">Główny nacisk / kontekst</label>
            <input
              type="text"
              value={focusArea}
              onChange={e => setFocusArea(e.target.value)}
              placeholder="np. Płynność mówienia, idiomy, negocjacje..."
              className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-xs text-white"
              disabled={loading}
            />
          </div>

          {/* Things to improve from previous lessons */}
          <div>
            <label className="block text-xs font-bold text-content-muted mb-1">
              Błędy kursanta do uwzględnienia w ćwiczeniach Practice (opcjonalnie)
            </label>
            <input
              type="text"
              value={thingsToImprove}
              onChange={e => setThingsToImprove(e.target.value)}
              placeholder="np. mylenie present perfect i past simple, kalki z polskiego..."
              className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-xs text-white"
              disabled={loading}
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-base-300/60 border border-white/5 text-xs text-content-muted space-y-1">
            <div className="text-white font-bold flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-primary" /> Co zawiera talia OpenAI 5.6 Luna?
            </div>
            <p>
              Tytuł + Warm-up pytania + Słownictwo z transkrypcją IPA + Analiza wzorców + <strong>Interaktywne ćwiczenia Practice</strong> (ze wskazówkami i wzorcami) + <strong>Moduł Enclosure</strong> (Quick Check & Exit Ticket).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="text-xs">
              Anuluj
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !topic.trim()}
              className="text-xs font-bold flex items-center gap-2 px-5 py-2.5"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Generowanie z OpenAI 5.6 Luna...</span>
                </>
              ) : (
                <>
                  <Wand2 size={15} />
                  <span>Generuj prezentację</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

