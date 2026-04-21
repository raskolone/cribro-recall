import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Flashcard, FlashcardSet } from '../../types';
import { getAISuggestions } from '../../services/aiSuggestions';
import AudioRecordButton from './AudioRecordButton';

interface FlashcardEditScreenProps {
  setId: string;
  onBack: () => void;
  onStudy: (setId: string) => void;
}

const LANGUAGES = [
  { code: 'pl', name: 'Polski' },
  { code: 'en', name: 'English' },
  { code: 'nl', name: 'Nederlands (Dutch)' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
];

const stripHtml = (html: string) => {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const RichTextInput = ({
  value,
  onChange,
  onBlur,
  onFocus,
  className,
  disabled
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  className?: string;
  disabled?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable={!disabled}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      onBlur={onBlur}
      onFocus={onFocus}
      className={className}
      suppressContentEditableWarning
    />
  );
};

const FlashcardEditScreen: React.FC<FlashcardEditScreenProps> = ({ setId, onBack, onStudy }) => {
  const { sets, getFlashcards, saveFlashcards, updateSet } = useFlashcards();
  const { t, language } = useLanguage();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<Partial<Flashcard>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true);
  
  // Autosave state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // AI Suggestion State
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importDelimiter, setImportDelimiter] = useState('tab');
  const [importTermLang, setImportTermLang] = useState('en');
  const [importDefLang, setImportDefLang] = useState('pl');

  // Toolbar State
  const [focusedField, setFocusedField] = useState<{index: number, field: 'term' | 'definition'} | null>(null);

  useEffect(() => {
    const currentSet = sets.find(s => s.id === setId);
    // Only initialize metadata if we haven't loaded it yet to prevent overwriting user input during autosave
    if (currentSet && !set) {
      setSet(currentSet);
      setTitle(currentSet.title);
      setDescription(currentSet.description || '');
      setIsPublic(currentSet.isPublic || false);
    }
  }, [setId, sets, set]);

  useEffect(() => {
    let isMounted = true;
    const loadCards = async () => {
      const loadedCards = await getFlashcards(setId);
      if (!isMounted) return;
      if (loadedCards.length === 0) {
        setCards([
          { id: `card-${Date.now()}-1`, term: '', definition: '', termLanguage: 'en', definitionLanguage: 'pl', isLocked: false },
          { id: `card-${Date.now()}-2`, term: '', definition: '', termLanguage: 'en', definitionLanguage: 'pl', isLocked: false }
        ]);
      } else {
        setCards(loadedCards);
      }
      setIsLoading(false);
    };
    
    loadCards();
    return () => { isMounted = false; };
  }, [setId, getFlashcards]);

  const triggerAutosave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const validCards = cards.filter(c => c.term?.trim() || c.definition?.trim());
        await saveFlashcards(setId, validCards);
        await updateSet(setId, { title, description, isPublic });
        setLastSaved(new Date());
      } catch (error) {
        console.error('Autosave failed', error);
      } finally {
        setIsSaving(false);
      }
    }, 30000); // 30 seconds
  }, [cards, title, description, isPublic, setId, saveFlashcards, updateSet]);

  // Trigger autosave whenever data changes
  useEffect(() => {
    if (!isLoading) {
      triggerAutosave();
    }
  }, [cards, title, description, isPublic, triggerAutosave, isLoading]);

  const handleAddCard = () => {
    const lastCard = cards[cards.length - 1];
    setCards([...cards, { 
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      term: '', 
      definition: '', 
      termLanguage: lastCard?.termLanguage || 'en', 
      definitionLanguage: lastCard?.definitionLanguage || 'pl',
      isLocked: false
    }]);
  };

  const handleUpdateCard = (index: number, field: keyof Flashcard, value: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCards(newCards);

    // AI Autocomplete Logic
    const plainText = stripHtml(value).trim();
    if (field === 'term' && aiSuggestionsEnabled && plainText.length >= 2) {
      if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
      
      suggestionTimeoutRef.current = setTimeout(async () => {
        setIsSuggesting(true);
        setActiveSuggestionIndex(index);
        try {
          const res = await getAISuggestions({
            action: 'autocomplete',
            term: plainText,
            source_language: newCards[index].termLanguage || 'en',
            target_language: newCards[index].definitionLanguage || 'pl',
            context: title
          });
          setSuggestions(res.suggestions || []);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSuggesting(false);
        }
      }, 300);
    } else if (field === 'term') {
      setSuggestions([]);
    }
  };

  const handleToggleLock = (index: number) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], isLocked: !newCards[index].isLocked };
    setCards(newCards);
  };

  const handleVoiceInput = (index: number) => {
    if (!('webkitSpeechRecognition' in window)) {
      alert(language === 'pl' ? 'Rozpoznawanie mowy nie jest obsługiwane w tej przeglądarce.' : 'Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    
    const fieldToUpdate = focusedField?.index === index ? focusedField.field : 'term';
    const lang = fieldToUpdate === 'term' ? cards[index].termLanguage : cards[index].definitionLanguage;
    
    recognition.lang = lang || 'en';
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const currentText = cards[index][fieldToUpdate] || '';
      handleUpdateCard(index, fieldToUpdate, currentText + (currentText ? ' ' : '') + transcript);
    };
    recognition.start();
  };

  const handleTermBlur = async (index: number) => {
    // Hide suggestions after a short delay to allow clicking them
    setTimeout(() => {
      if (activeSuggestionIndex === index) {
        setSuggestions([]);
        setActiveSuggestionIndex(null);
      }
    }, 200);

    // AI Definition Generation
    const card = cards[index];
    const plainTerm = stripHtml(card.term || '').trim();
    const plainDef = stripHtml(card.definition || '').trim();
    
    if (aiSuggestionsEnabled && plainTerm && !plainDef) {
      try {
        const res = await getAISuggestions({
          action: 'define',
          term: plainTerm,
          source_language: card.termLanguage || 'en',
          target_language: card.definitionLanguage || 'pl',
          context: title
        });
        if (res.definition) {
          handleUpdateCard(index, 'definition', res.definition);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleAcceptSuggestion = (index: number, suggestion: string) => {
    handleUpdateCard(index, 'term', suggestion);
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    // Trigger definition generation immediately
    setTimeout(() => handleTermBlur(index), 50);
  };

  const handleRemoveCard = (index: number) => {
    const newCards = [...cards];
    newCards.splice(index, 1);
    setCards(newCards);
  };

  const handleManualSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);
    try {
      const validCards = cards.filter(c => c.term?.trim() || c.definition?.trim());
      await saveFlashcards(setId, validCards);
      await updateSet(setId, { title, description, isPublic });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save failed', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    
    const delimiterChar = importDelimiter === 'tab' ? '\t' : importDelimiter === 'comma' ? ',' : ';';
    const lines = importText.split('\n');
    
    const newCards: Partial<Flashcard>[] = [];
    
    lines.forEach((line, idx) => {
      const parts = line.split(delimiterChar);
      if (parts.length >= 2) {
        newCards.push({
          id: `card-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          term: parts[0].trim(),
          definition: parts[1].trim(),
          termLanguage: importTermLang,
          definitionLanguage: importDefLang,
          isLocked: false
        });
      }
    });
    
    if (newCards.length > 0) {
      setCards(prev => [...prev, ...newCards]);
    }
    
    setIsImportModalOpen(false);
    setImportText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 sticky top-0 bg-base-100/90 backdrop-blur-md z-20 py-4 border-b border-base-300">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <button onClick={onBack} className="text-content-muted hover:text-white transition-colors">
              &larr; {language === 'pl' ? 'Wróć' : 'Back'}
            </button>
            <h1 className="text-2xl font-bold">
              {set?.title ? (language === 'pl' ? 'Edytuj zestaw' : 'Edit set') : (language === 'pl' ? 'Stwórz nowy zestaw fiszek' : 'Create new flashcard set')}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button 
              onClick={() => setIsPublic(!isPublic)}
              className={`px-3 py-1 rounded-full border font-medium transition-colors ${isPublic ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-base-300 border-base-300 text-content-muted'}`}
            >
              {isPublic ? (language === 'pl' ? 'Publiczny' : 'Public') : (language === 'pl' ? 'Prywatny' : 'Private')}
            </button>
            <span className="text-content-muted">
              {isSaving ? (language === 'pl' ? 'Zapisywanie...' : 'Saving...') : 
               lastSaved ? (language === 'pl' ? 'Zapisano' : 'Saved') : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleManualSave}>
            {language === 'pl' ? 'Stwórz' : 'Create'}
          </Button>
          <Button onClick={async () => {
            await handleManualSave();
            onStudy(setId);
          }}>
            {language === 'pl' ? 'Stwórz i ćwicz' : 'Create and Study'}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-4 mb-8">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-xl font-bold bg-transparent border-b-2 border-base-300 focus:border-primary focus:outline-none px-2 py-2 transition-colors placeholder-content-muted/50"
          placeholder={language === 'pl' ? 'Wpisz tytuł, np. "Biologia - Rozdział 22"' : 'Enter title, e.g. "Biology - Chapter 22"'}
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full text-base bg-transparent border-b-2 border-base-300 focus:border-primary focus:outline-none px-2 py-2 transition-colors placeholder-content-muted/50"
          placeholder={language === 'pl' ? 'Dodaj opis...' : 'Add a description...'}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="text-sm font-medium text-content-muted hover:text-white transition-colors flex items-center gap-2"
          >
            <span>+</span> {language === 'pl' ? 'Importuj' : 'Import'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-sm font-medium ${aiSuggestionsEnabled ? 'text-blue-400' : 'text-content-muted'}`}>
              {language === 'pl' ? 'Sugestie' : 'Suggestions'}
            </span>
            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${aiSuggestionsEnabled ? 'bg-blue-500' : 'bg-base-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${aiSuggestionsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={aiSuggestionsEnabled} 
              onChange={(e) => setAiSuggestionsEnabled(e.target.checked)} 
            />
          </label>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-6">
        {cards.map((card, index) => (
          <Card key={card.id || index} className="p-0 overflow-visible relative group bg-base-100 border border-base-300 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 rounded-2xl">
            {/* Hover Toolbar */}
            <div className="absolute -top-12 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-base-300/90 backdrop-blur-md p-1.5 rounded-xl z-10 shadow-xl border border-white/10">
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }} className="w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded-lg text-content-muted hover:text-white font-bold transition-colors" title="Bold">B</button>
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }} className="w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded-lg text-content-muted hover:text-white italic font-serif transition-colors" title="Italic">I</button>
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); }} className="w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded-lg text-content-muted hover:text-white underline transition-colors" title="Underline">U</button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <input type="color" onInput={(e) => document.execCommand('foreColor', false, e.currentTarget.value)} className="w-6 h-6 p-0 border-0 rounded cursor-pointer mx-1" title="Color" />
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button onMouseDown={(e) => { e.preventDefault(); handleVoiceInput(index); }} className="w-8 h-8 flex items-center justify-center hover:bg-blue-500/20 rounded-lg text-blue-400 hover:text-blue-300 transition-colors" title="Voice Input">🎤</button>
              <button 
                onMouseDown={(e) => { e.preventDefault(); handleToggleLock(index); }} 
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${card.isLocked ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'hover:bg-base-200 text-content-muted hover:text-white'}`} 
                title={card.isLocked ? 'Unlock' : 'Lock'}
              >
                {card.isLocked ? '🔒' : '🔓'}
              </button>
            </div>

            {/* Card Header */}
            <div className={`flex items-center justify-between px-6 py-3 border-b transition-colors rounded-t-2xl ${card.isLocked ? 'bg-orange-500/5 border-orange-500/10' : 'bg-base-200/50 border-base-300'}`}>
              <span className={`font-black text-lg ${card.isLocked ? 'text-orange-500/70' : 'text-content-muted'}`}>{index + 1}</span>
              <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-content-muted hover:text-white cursor-grab p-1">☰</button>
                <button onClick={() => handleRemoveCard(index)} className="text-content-muted hover:text-red-400 p-1 transition-colors">🗑</button>
              </div>
            </div>
            
            {/* Card Body */}
            <div className={`p-6 sm:p-8 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-8 sm:gap-10 items-start transition-opacity ${card.isLocked ? 'opacity-70' : 'opacity-100'}`}>
              {/* Term */}
              <div className="relative">
                <div className="flex justify-between mb-3 border-b-2 border-transparent">
                  <span className="text-xs font-bold text-content-muted uppercase tracking-widest">{language === 'pl' ? 'POJĘCIE' : 'TERM'}</span>
                  <select 
                    value={card.termLanguage || 'en'}
                    onChange={(e) => handleUpdateCard(index, 'termLanguage', e.target.value)}
                    className="text-xs bg-transparent text-primary uppercase font-bold focus:outline-none cursor-pointer appearance-none px-2"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-base-200 text-content">{l.name}</option>)}
                  </select>
                </div>
                <RichTextInput
                  value={card.term || ''}
                  disabled={card.isLocked}
                  onFocus={() => setFocusedField({index, field: 'term'})}
                  onChange={(val) => handleUpdateCard(index, 'term', val)}
                  onBlur={() => handleTermBlur(index)}
                  className={`w-full bg-transparent border-b-2 border-base-300 focus:border-primary focus:outline-none py-2 text-xl font-medium transition-colors min-h-[44px] ${card.isLocked ? 'cursor-not-allowed' : ''}`}
                />
                
                {/* AI Suggestions Dropdown */}
                {activeSuggestionIndex === index && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-base-200 border border-base-300 rounded-xl shadow-2xl z-30 overflow-hidden backdrop-blur-xl">
                    {suggestions.map((sug, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-5 py-3 hover:bg-primary/10 hover:text-primary transition-colors text-sm font-medium border-b border-base-300/50 last:border-0"
                        onClick={() => handleAcceptSuggestion(index, sug)}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Definition */}
              <div>
                <div className="flex justify-between mb-3 border-b-2 border-transparent">
                  <span className="text-xs font-bold text-content-muted uppercase tracking-widest">{language === 'pl' ? 'DEFINICJA' : 'DEFINITION'}</span>
                  <select 
                    value={card.definitionLanguage || 'pl'}
                    onChange={(e) => handleUpdateCard(index, 'definitionLanguage', e.target.value)}
                    className="text-xs bg-transparent text-primary uppercase font-bold focus:outline-none cursor-pointer appearance-none px-2"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-base-200 text-content">{l.name}</option>)}
                  </select>
                </div>
                <RichTextInput
                  value={card.definition || ''}
                  disabled={card.isLocked}
                  onFocus={() => setFocusedField({index, field: 'definition'})}
                  onChange={(val) => handleUpdateCard(index, 'definition', val)}
                  className={`w-full bg-transparent border-b-2 border-base-300 focus:border-primary focus:outline-none py-2 text-xl transition-colors min-h-[44px] ${card.isLocked ? 'cursor-not-allowed text-content-muted' : ''}`}
                />
              </div>

              {/* Media Controls */}
              <div className="h-full flex flex-row md:flex-col items-center md:items-end justify-center md:justify-end gap-6 md:gap-4 pb-2 pt-6 md:pt-2 border-t md:border-t-0 md:border-l border-base-300 md:pl-8">
                <div className="flex flex-col items-center md:items-end gap-2 group/media cursor-pointer">
                  <span className="text-[10px] font-bold text-content-muted uppercase tracking-widest group-hover/media:text-white transition-colors">{language === 'pl' ? 'OBRAZ' : 'IMAGE'}</span>
                  <button className="w-16 h-12 border-2 border-dashed border-base-300 rounded-lg flex items-center justify-center text-content-muted group-hover/media:border-primary group-hover/media:text-primary transition-all bg-base-200/50 hover:bg-primary/5">
                    <span className="text-lg font-bold">+</span>
                  </button>
                </div>
                <div className="flex flex-col items-center md:items-end gap-2 group/media">
                  <span className="text-[10px] font-bold text-content-muted uppercase tracking-widest group-hover/media:text-white transition-colors">{language === 'pl' ? 'WYMOWA' : 'AUDIO'}</span>
                  <AudioRecordButton 
                    audioUrl={card.audioUrl} 
                    onAudioUpload={(base64Audio) => handleUpdateCard(index, 'audioUrl', base64Audio)}
                    onAudioRemove={() => handleUpdateCard(index, 'audioUrl', '')}
                  />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Card Button */}
      <Card 
        className="mt-6 border-dashed border-2 border-base-300 bg-transparent hover:bg-white/5 cursor-pointer flex items-center justify-center py-8 transition-colors group"
        onClick={handleAddCard}
      >
        <div className="text-center group-hover:text-primary transition-colors">
          <div className="text-2xl font-bold mb-1">+</div>
          <div className="font-bold uppercase tracking-wider text-sm">{language === 'pl' ? 'Dodaj fiszkę' : 'Add Card'}</div>
        </div>
      </Card>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{language === 'pl' ? 'Importuj fiszki' : 'Import flashcards'}</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-content-muted hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div>
                <p className="text-content-muted mb-4">
                  {language === 'pl' 
                    ? 'Wklej swoje dane poniżej lub prześlij plik. Użyj wybranego separatora (np. tabulator, przecinek), aby oddzielić pojęcie od definicji.' 
                    : 'Paste your data below or upload a file. Use the selected delimiter (e.g. tab, comma) to separate the term from the definition.'}
                </p>
                
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{language === 'pl' ? 'Separator:' : 'Delimiter:'}</label>
                    <select 
                      value={importDelimiter} 
                      onChange={(e) => setImportDelimiter(e.target.value)}
                      className="bg-base-200 border border-base-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="tab">{language === 'pl' ? 'Tabulator' : 'Tab'}</option>
                      <option value="comma">{language === 'pl' ? 'Przecinek' : 'Comma'}</option>
                      <option value="semicolon">{language === 'pl' ? 'Średnik' : 'Semicolon'}</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{language === 'pl' ? 'Język pojęcia:' : 'Term language:'}</label>
                    <select 
                      value={importTermLang} 
                      onChange={(e) => setImportTermLang(e.target.value)}
                      className="bg-base-200 border border-base-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                    >
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{language === 'pl' ? 'Język definicji:' : 'Def language:'}</label>
                    <select 
                      value={importDefLang} 
                      onChange={(e) => setImportDefLang(e.target.value)}
                      className="bg-base-200 border border-base-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                    >
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full h-64 bg-base-200 border border-base-300 rounded-lg p-4 focus:outline-none focus:border-primary font-mono text-sm resize-y"
                  placeholder={language === 'pl' ? 'Pojęcie 1\\tDefinicja 1\\nPojęcie 2\\tDefinicja 2' : 'Term 1\\tDefinition 1\\nTerm 2\\tDefinition 2'}
                />
              </div>
              
              <div className="flex items-center gap-4 pt-4 border-t border-base-300">
                <label className="flex-1">
                  <div className="border-2 border-dashed border-base-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:text-primary transition-colors">
                    <span className="text-sm font-medium">{language === 'pl' ? 'Wybierz plik (.csv, .txt)' : 'Choose file (.csv, .txt)'}</span>
                    <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} className="hidden" />
                  </div>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-base-300">
              <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button onClick={handleImport} disabled={!importText.trim()}>
                {language === 'pl' ? 'Importuj' : 'Import'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FlashcardEditScreen;
