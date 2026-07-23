import { auth } from '../../firebase';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFlashcards } from '../../context/FlashcardContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Flashcard, FlashcardSet } from '../../types';
import { getAISuggestions } from '../../services/aiSuggestions';
import { generateFlashcardsFromText, formatFlashcardsWithAI, generateContextSentence, generateImageForTerm } from '../../services/geminiService';
import i18n from "i18next";

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
  const { user, connectGoogleWorkspace } = useAuth();
  const [isFormattingWithAI, setIsFormattingWithAI] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
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
  const [isImportingWithAI, setIsImportingWithAI] = useState(false);
  const [isGeneratingImageFor, setIsGeneratingImageFor] = useState<number | null>(null);
  const [isGeneratingContextFor, setIsGeneratingContextFor] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsImportModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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


  const handleGenerateImage = async (index: number) => {
    const card = cards[index];
    if (!card.term) return;
    setIsGeneratingImageFor(index);
    try {
      const b64 = await generateImageForTerm(card.term, card.definition);
      if (b64) {
        handleUpdateCard(index, 'imageUrl', b64);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate image.');
    } finally {
      setIsGeneratingImageFor(null);
    }
  };

  const handleGenerateContext = async (index: number) => {
    const card = cards[index];
    if (!card.term) return;
    setIsGeneratingContextFor(index);
    try {
      const sentence = await generateContextSentence(card.term, card.termLanguage || 'en');
      if (sentence) {
        handleUpdateCard(index, 'contextSentence', sentence);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate context.');
    } finally {
      setIsGeneratingContextFor(null);
    }
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
    
    if (aiSuggestionsEnabled && plainTerm) {
      try {
        if (!plainDef) {
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
        }
        // Always try to generate context sentence if missing and AI is enabled
        const plainContext = stripHtml(card.contextSentence || '').trim();
        if (!plainContext) {
          const sentence = await generateContextSentence(plainTerm, card.termLanguage || 'en');
          if (sentence) {
            handleUpdateCard(index, 'contextSentence', sentence);
          }
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

  
  const fetchDriveFiles = async () => {
    if (!auth.currentUser?.providerData?.some(p => p.providerId === 'google.com')) {
      alert(language === 'pl' ? 'Musisz najpierw powiązać swoje konto z Google w Ustawieniach.' : 'You must link your account with Google in Settings first.');
      return;
    }

    try {
      setDriveLoading(true);
      setShowDriveModal(true);
      setDriveError(null);
      const token = await connectGoogleWorkspace();
      const query = encodeURIComponent("mimeType='application/vnd.google-apps.document' or mimeType='application/pdf' or mimeType='text/plain'");
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && !err.message?.includes('popup')) {
        console.error(err);
      }
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup')) {
        setDriveError('Aby zalogować się do Google Drive, otwórz aplikację w nowej karcie (przycisk w prawym górnym rogu) lub zezwól na wyskakujące okienka.');
      } else {
        setDriveError('Nie udało się połączyć z dyskiem Google.');
      }
    } finally {
      setDriveLoading(false);
    }
  };

  const processDriveFile = async (file: any) => {
    try {
      setDriveLoading(true);
      const token = await connectGoogleWorkspace();
      let textContent = '';
      if (file.mimeType === 'application/pdf') {
        alert('PDF not supported here yet. Please use Docs or Text files.');
        return;
      } else if (file.mimeType === 'application/vnd.google-apps.document') {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        textContent = await res.text();
      } else {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        textContent = await res.text();
      }
      setImportText(prev => prev + (prev ? '\n' : '') + textContent);
      setShowDriveModal(false);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && !err.message?.includes('popup')) {
        console.error(err);
      }
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup')) {
        alert('Aby zalogować się do Google Drive, otwórz aplikację w nowej karcie (przycisk w prawym górnym rogu) lub zezwól na wyskakujące okienka.');
      } else {
        alert('Błąd przetwarzania pliku: ' + (err.message || 'Nieznany błąd'));
      }
    } finally {
      setDriveLoading(false);
    }
  };

  const handleFormatTextWithAI = async () => {
    if (!importText.trim()) return;
    setIsFormattingWithAI(true);
    try {
      const res = await formatFlashcardsWithAI(importText);
      setImportText(res.formattedText);
      if (res.termLang) setImportTermLang(res.termLang);
      if (res.defLang) setImportDefLang(res.defLang);
      setImportDelimiter('tab');
    } catch (error) {
      console.error(error);
      alert('Failed to format text with AI.');
    } finally {
      setIsFormattingWithAI(false);
    }
  };

  const handleImportWithAI = async () => {
    if (!importText.trim()) return;
    setIsImportingWithAI(true);
    try {
      const generatedCards = await generateFlashcardsFromText(importText, importTermLang, importDefLang);
      if (generatedCards && generatedCards.length > 0) {
        const newCards: Partial<Flashcard>[] = generatedCards.map((c, idx) => ({
          id: `card-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          term: c.term,
          definition: c.definition,
          contextSentence: c.contextSentence,
          termLanguage: importTermLang,
          definitionLanguage: importDefLang,
          isLocked: false
        }));
        setCards(prev => [...prev, ...newCards]);
        setIsImportModalOpen(false);
        setImportText('');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to import with AI. Check your API Key.');
    } finally {
      setIsImportingWithAI(false);
    }
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
              
                                        {i18n.t("&larr;")} {language === 'pl' ? 'Wróć' : 'Back'}
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
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }} className="w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded-lg text-content-muted hover:text-white font-bold transition-colors" title={i18n.t("Bold")}>B</button>
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }} className="w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded-lg text-content-muted hover:text-white italic font-serif transition-colors" title={i18n.t("Italic")}>I</button>
              <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); }} className="w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded-lg text-content-muted hover:text-white underline transition-colors" title={i18n.t("Underline")}>U</button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <input type="color" onInput={(e) => document.execCommand('foreColor', false, e.currentTarget.value)} className="w-6 h-6 p-0 border-0 rounded cursor-pointer mx-1" title={i18n.t("Color")} />
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button onMouseDown={(e) => { e.preventDefault(); handleVoiceInput(index); }} className="w-8 h-8 flex items-center justify-center hover:bg-blue-500/20 rounded-lg text-blue-400 hover:text-blue-300 transition-colors" title={i18n.t("Voice Input")}>🎤</button>
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
                  <div className="absolute top-full left-0 w-full mt-2 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden backdrop-blur-xl">
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
                <div className="flex flex-col items-center md:items-end gap-2 group/media">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-content-muted uppercase tracking-widest">{language === 'pl' ? 'OBRAZ' : 'IMAGE'}</span>
                    <button onClick={() => handleGenerateImage(index)} disabled={isGeneratingImageFor === index || card.isLocked} className="text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors uppercase" title={i18n.t("Generate with AI")}>{i18n.t("✨ AI")}</button>
                  </div>
                  {card.imageUrl ? (
                    <div className="relative group/img">
                      <img src={card.imageUrl} alt={i18n.t("Card visual")} className="w-16 h-12 object-cover rounded-lg border border-white/10" referrerPolicy="no-referrer" />
                      <button onClick={() => handleUpdateCard(index, 'imageUrl', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover/img:opacity-100 transition-opacity">×</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => handleUpdateCard(index, 'imageUrl', reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" title={i18n.t("Upload Image")} />
                      <button className="w-16 h-12 border-2 border-dashed border-base-300 rounded-lg flex items-center justify-center text-content-muted transition-all bg-base-200/50 hover:bg-primary/5 relative">
                        {isGeneratingImageFor === index ? <span className="animate-spin text-lg">⏳</span> : <span className="text-lg font-bold">+</span>}
                      </button>
                    </div>
                  )}
                </div>

              </div>
              
              {/* Context Sentence (Full Width) */}
              <div className="col-span-1 md:col-span-3 pt-4 border-t border-base-300/50">
                <div>
                  <div className="flex justify-between mb-3 border-b-2 border-transparent">
                    <span className="text-xs font-bold text-content-muted uppercase tracking-widest">{language === 'pl' ? 'ZDANIE Z KONTEKSTEM' : 'CONTEXT SENTENCE'}</span>
                    <button onClick={() => handleGenerateContext(index)} disabled={isGeneratingContextFor === index || card.isLocked} className="text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors uppercase" title={i18n.t("Generate Context with AI")}>
                      {isGeneratingContextFor === index ? '⏳' : '✨ AI'}
                    </button>
                  </div>
                  <RichTextInput
                    value={card.contextSentence || ''}
                    disabled={card.isLocked}
                    onChange={(val) => handleUpdateCard(index, 'contextSentence', val)}
                    className={`w-full bg-transparent border-b-2 border-base-300 focus:border-primary focus:outline-none py-1 text-base transition-colors min-h-[36px] ${card.isLocked ? 'cursor-not-allowed text-content-muted' : ''}`}
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
              <button onClick={() => setIsImportModalOpen(false)} className="text-content-muted hover:text-white text-2xl">{i18n.t("&times;")}</button>
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
                      className="bg-base-200/40 backdrop-blur-md border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
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
                      className="bg-base-200/40 backdrop-blur-md border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                    >
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{language === 'pl' ? 'Język definicji:' : 'Def language:'}</label>
                    <select 
                      value={importDefLang} 
                      onChange={(e) => setImportDefLang(e.target.value)}
                      className="bg-base-200/40 backdrop-blur-md border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                    >
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full h-64 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-4 focus:outline-none focus:border-primary font-mono text-sm resize-y"
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
                <div className="flex-1">
                  <div onClick={fetchDriveFiles} className="border-2 border-dashed border-base-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    <span className="text-sm font-medium">{i18n.t("Google Drive")}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleFormatTextWithAI} disabled={!importText.trim() || isFormattingWithAI} variant="secondary" className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 hover:text-white border-transparent">
                  {isFormattingWithAI ? '...' : (language === 'pl' ? 'Kosmetyka AI (Flashlight) ✨' : 'Clean up with AI ✨')}
                </Button>
              </div>

            </div>
            
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-base-300">
              <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button variant="secondary" onClick={handleImportWithAI} disabled={!importText.trim() || isImportingWithAI} className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-white border-transparent">
                {isImportingWithAI ? (language === 'pl' ? 'Analizowanie...' : 'Analyzing...') : (language === 'pl' ? 'Import z AI ✨' : 'Import with AI ✨')}
              </Button>
              <Button onClick={handleImport} disabled={!importText.trim() || isImportingWithAI}>
                {language === 'pl' ? 'Importuj standardowo' : 'Standard Import'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showDriveModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 md:p-6 overflow-y-auto">
          <div className="bg-base-100 p-6 rounded-xl w-full max-w-2xl border border-white/10 shadow-2xl relative my-auto">
            <h3 className="text-xl font-bold mb-4">{i18n.t("Wybierz plik z Google Drive")}</h3>
            {driveError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-4 text-sm">
                {driveError}
              </div>
            )}
            {driveLoading ? (
              <div className="text-center p-8 text-content-muted">{i18n.t("Ładowanie plików...")}</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {driveFiles.map(file => (
                  <div key={file.id} onClick={() => processDriveFile(file)} className="p-3 bg-base-200/50 hover:bg-base-200 rounded-lg cursor-pointer flex justify-between items-center border border-white/5 transition-colors">
                    <span className="font-medium text-sm text-white truncate max-w-[80%]">{file.name}</span>
                    <span className="text-xs text-content-muted">{file.mimeType.includes('pdf') ? 'PDF' : (file.mimeType.includes('document') ? 'DOC' : 'TXT')}</span>
                  </div>
                ))}
                {driveFiles.length === 0 && <div className="text-center text-content-muted">{i18n.t("Brak odpowiednich plików.")}</div>}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setShowDriveModal(false)}>{i18n.t("Anuluj")}</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FlashcardEditScreen;
