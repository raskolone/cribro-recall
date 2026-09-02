import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Layers, Clock, Bookmark, Sparkles } from 'lucide-react';
import { PresentationSlide, PresentationSlideItem, PresentationSlideType } from '../../../types';
import Button from '../../ui/Button';

interface SlideEditorModalProps {
  slide?: PresentationSlide | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (slide: PresentationSlide) => void;
}

export const SlideEditorModal: React.FC<SlideEditorModalProps> = ({
  slide,
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen) return null;

  const [type, setType] = useState<PresentationSlideType>(slide?.type || 'freeform');
  const [title, setTitle] = useState(slide?.title || '');
  const [subtitle, setSubtitle] = useState(slide?.subtitle || '');
  const [content, setContent] = useState(slide?.content || '');
  const [timerMinutes, setTimerMinutes] = useState(slide?.timerMinutes || 10);
  const [speakerNotes, setSpeakerNotes] = useState(slide?.speakerNotes || '');
  const [bgTheme, setBgTheme] = useState<PresentationSlide['bgTheme']>(slide?.bgTheme || 'dark');
  const [items, setItems] = useState<PresentationSlideItem[]>(slide?.items || []);

  const handleAddItem = () => {
    const newItem: PresentationSlideItem = {
      id: `item-${Date.now()}`,
      term: '',
      definition: '',
      example: '',
      question: '',
      errorText: '',
      correctionText: '',
      answer: ''
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<PresentationSlideItem>) => {
    setItems(items.map(it => it.id === id ? { ...it, ...updates } : it));
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(it => it.id !== id));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Wpisz tytuł slajdu');
      return;
    }

    const newSlide: PresentationSlide = {
      id: slide?.id || `slide-${Date.now()}`,
      type,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      content: content.trim() || undefined,
      timerMinutes: Number(timerMinutes) || 10,
      speakerNotes: speakerNotes.trim() || undefined,
      bgTheme,
      items: items.length > 0 ? items : undefined
    };

    onSave(newSlide);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-base-200 border border-white/15 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-base-300/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {slide ? 'Edytuj slajd' : 'Dodaj nowy slajd'}
              </h3>
              <p className="text-xs text-content-muted">Dostosuj zawartość, pytania i słownictwo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-content-muted mb-1">Typ slajdu</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as PresentationSlideType)}
                className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value="title">Tytułowy / Wstęp (Title)</option>
                <option value="warmup">Warm-up / Pytania rozgrzewkowe</option>
                <option value="vocabulary">Słownictwo & Wymowa (Vocabulary)</option>
                <option value="grammar">Struktury językowe (Grammar / Formula)</option>
                <option value="speaking">Konwersacje / Scenka (Speaking)</option>
                <option value="practice">Ćwiczenia / Drills (Practice)</option>
                <option value="enclosure">Enclosure (Podsumowanie, Quick Check, Exit Ticket)</option>
                <option value="correction">Poprawki językowe (Correction)</option>
                <option value="summary">Podsumowanie lekcji (Summary)</option>
                <option value="freeform">Dowolny tekst / Markdown</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-content-muted mb-1">Motyw graficzny</label>
              <select
                value={bgTheme}
                onChange={e => setBgTheme(e.target.value as any)}
                className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value="dark">Ciemny grafit (Dark)</option>
                <option value="emerald">Szmaragdowy akcent (Emerald)</option>
                <option value="midnight">Granat / Północ (Midnight)</option>
                <option value="amber">Ciepły bursztyn (Amber)</option>
                <option value="clean-light">Jasny studyjny (Clean Light)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-content-muted mb-1">Tytuł slajdu *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="np. Key Vocabulary & Phrasal Verbs"
              className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-content-muted mb-1">Podtytuł / Opis etapu</label>
            <input
              type="text"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="np. Rozgrzewka konwersacyjna (5-8 min)"
              className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-content-muted mb-1">Treść główna / Markdown</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              placeholder="Wpisz treść, regułę gramatyczną lub opis scenki..."
              className="w-full bg-base-300 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
            />
          </div>

          {/* DYNAMIC ITEMS LIST (Questions / Vocab / Practice) */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary" /> Elementy interaktywne ({items.length})
              </label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddItem}
                className="text-xs font-bold flex items-center gap-1"
              >
                <Plus size={13} /> Dodaj element
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-content-muted italic">Brak dodatkowych elementów kafelkowych.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-3.5 rounded-xl bg-base-300/80 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-primary"># {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-content-muted hover:text-rose-400 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {(type === 'warmup' || type === 'speaking' || type === 'practice') ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={item.question || ''}
                          onChange={e => handleUpdateItem(item.id, { question: e.target.value })}
                          placeholder="Pytanie lub zadanie..."
                          className="w-full bg-base-200 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none"
                        />
                        {type === 'practice' && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={item.hint || ''}
                              onChange={e => handleUpdateItem(item.id, { hint: e.target.value })}
                              placeholder="Wskazówka (hint)..."
                              className="bg-base-200 border border-white/10 rounded-lg p-2 text-xs text-white"
                            />
                            <input
                              type="text"
                              value={item.answer || ''}
                              onChange={e => handleUpdateItem(item.id, { answer: e.target.value })}
                              placeholder="Wzorcowa odpowiedź..."
                              className="bg-base-200 border border-white/10 rounded-lg p-2 text-xs text-white"
                            />
                          </div>
                        )}
                      </div>
                    ) : type === 'vocabulary' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={item.term || ''}
                          onChange={e => handleUpdateItem(item.id, { term: e.target.value })}
                          placeholder="Słówko / Fraza EN"
                          className="bg-base-200 border border-white/10 rounded-lg p-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={item.definition || ''}
                          onChange={e => handleUpdateItem(item.id, { definition: e.target.value })}
                          placeholder="Tłumaczenie PL"
                          className="bg-base-200 border border-white/10 rounded-lg p-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={item.example || ''}
                          onChange={e => handleUpdateItem(item.id, { example: e.target.value })}
                          placeholder="Zdanie przykładowe"
                          className="bg-base-200 border border-white/10 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={item.errorText || ''}
                          onChange={e => handleUpdateItem(item.id, { errorText: e.target.value })}
                          placeholder="Błąd (np. He go)"
                          className="bg-base-200 border border-rose-400/20 rounded-lg p-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={item.correctionText || ''}
                          onChange={e => handleUpdateItem(item.id, { correctionText: e.target.value })}
                          placeholder="Poprawka (np. He goes)"
                          className="bg-base-200 border border-emerald-400/20 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <div>
              <label className="block text-xs font-bold text-content-muted mb-1">Sugerowany czas (min)</label>
              <input
                type="number"
                value={timerMinutes}
                onChange={e => setTimerMinutes(Number(e.target.value))}
                min={1}
                max={90}
                className="w-full bg-base-300 border border-white/10 rounded-xl p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-content-muted mb-1">Notatka dla nauczyciela (Speaker notes)</label>
              <input
                type="text"
                value={speakerNotes}
                onChange={e => setSpeakerNotes(e.target.value)}
                placeholder="Wskazówki metodyczne..."
                className="w-full bg-base-300 border border-white/10 rounded-xl p-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
              Anuluj
            </Button>
            <Button type="submit" variant="primary" className="text-xs font-bold flex items-center gap-1.5">
              <Save size={14} /> Zapisz slajd
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
