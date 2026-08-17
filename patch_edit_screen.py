import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

# Fix Zakończ i Zapisz -> Zakończ and Zakończ i Ćwicz -> Zakończ i Ćwicz is fine, but maybe change to Zapisz.
content = content.replace("{language === 'pl' ? 'Zakończ i Zapisz' : 'Finish & Save'}", "{language === 'pl' ? 'Zapisz' : 'Save'}")
content = content.replace("{language === 'pl' ? 'Zakończ i Ćwicz' : 'Finish & Study'}", "{language === 'pl' ? 'Zapisz i Ćwicz' : 'Save & Study'}")

# Add the AI generator state & modal
state_add = """  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAIGenModalOpen, setIsAIGenModalOpen] = useState(false);
  const [aiGenTopic, setAiGenTopic] = useState('');
  const [aiGenCount, setAiGenCount] = useState(10);
  const [isGeneratingAITopic, setIsGeneratingAITopic] = useState(false);"""
content = content.replace("  const [isImportModalOpen, setIsImportModalOpen] = useState(false);", state_add)

# Add the generate function
gen_func = """  const handleGenerateFromTopic = async () => {
    if (!aiGenTopic.trim()) return;
    setIsGeneratingAITopic(true);
    try {
      // @ts-ignore
      const { generateFlashcardsFromTopicWithGPT } = await import('../../services/geminiService');
      const generatedCards = await generateFlashcardsFromTopicWithGPT(aiGenTopic, aiGenCount, importTermLang, importDefLang);
      if (generatedCards && generatedCards.length > 0) {
        const newCards: Partial<Flashcard>[] = generatedCards.map((c: any, idx: number) => ({
          id: `card-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          term: c.term,
          definition: c.definition,
          contextSentence: c.contextSentence,
          termLanguage: importTermLang,
          definitionLanguage: importDefLang,
          isLocked: false
        }));
        setCards(prev => [...prev, ...newCards]);
        setIsAIGenModalOpen(false);
        setAiGenTopic('');
      } else {
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek.' : 'Failed to generate vocabulary.');
      }
    } catch (err: any) {
      console.error(err);
      alert(language === 'pl' ? 'Błąd podczas generowania: ' + err.message : 'Error generating: ' + err.message);
    } finally {
      setIsGeneratingAITopic(false);
    }
  };

  const handleImportWithAI = async () => {"""
content = content.replace("  const handleImportWithAI = async () => {", gen_func)

# Fix the import button and add the new generate button
old_buttons = """        <div className="flex justify-between items-center px-1">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="text-sm text-content-muted hover:text-primary transition-colors flex items-center gap-2"
          >
            <span>+</span> {language === 'pl' ? 'Importuj (również z AI)' : 'Import (incl. AI)'}
          </button>
          
          <div className="flex items-center gap-3">"""

new_buttons = """        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="text-sm text-content-muted hover:text-primary transition-colors flex items-center gap-2"
            >
              <span>+</span> {language === 'pl' ? 'Importuj z tekstu' : 'Import from text'}
            </button>
            <button 
              onClick={() => setIsAIGenModalOpen(true)}
              className="text-sm text-amber-500/80 hover:text-amber-400 transition-colors flex items-center gap-2 font-medium"
            >
              <Sparkles className="w-4 h-4" /> {language === 'pl' ? 'Generuj z AI (Temat)' : 'Generate with AI (Topic)'}
            </button>
          </div>
          
          <div className="flex items-center gap-3">"""

content = content.replace(old_buttons, new_buttons)

# Inject the AI Generation Modal
import_modal = """      {/* Import Modal */}"""

ai_gen_modal = """      {/* AI Generator Modal */}
      {isAIGenModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-400" />
                {language === 'pl' ? 'Generuj słówka z AI' : 'Generate vocabulary with AI'}
              </h2>
              <button onClick={() => setIsAIGenModalOpen(false)} className="text-content-muted hover:text-white text-2xl">{i18n.t("&times;")}</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{language === 'pl' ? 'Temat (np. Podróże samolotem)' : 'Topic (e.g. Air travel)'}</label>
                <input 
                  type="text" 
                  value={aiGenTopic}
                  onChange={(e) => setAiGenTopic(e.target.value)}
                  className="w-full bg-base-200/40 border border-white/10 rounded px-3 py-2 focus:outline-none focus:border-primary"
                  placeholder={language === 'pl' ? 'Wpisz dowolny temat...' : 'Enter any topic...'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">{language === 'pl' ? 'Ilość słówek' : 'Word count'} ({aiGenCount})</label>
                <input 
                  type="range" 
                  min="5" 
                  max="50" 
                  step="5"
                  value={aiGenCount}
                  onChange={(e) => setAiGenCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">{language === 'pl' ? 'Język pojęcia' : 'Term language'}</label>
                  <select 
                    value={importTermLang} 
                    onChange={(e) => setImportTermLang(e.target.value)}
                    className="w-full bg-base-200/40 border border-white/10 rounded px-3 py-2 focus:outline-none focus:border-primary"
                  >
                    {LANGUAGES.map((l: any) => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">{language === 'pl' ? 'Język definicji' : 'Def language'}</label>
                  <select 
                    value={importDefLang} 
                    onChange={(e) => setImportDefLang(e.target.value)}
                    className="w-full bg-base-200/40 border border-white/10 rounded px-3 py-2 focus:outline-none focus:border-primary"
                  >
                    {LANGUAGES.map((l: any) => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-8">
              <Button variant="secondary" onClick={() => setIsAIGenModalOpen(false)}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleGenerateFromTopic} 
                disabled={!aiGenTopic.trim() || isGeneratingAITopic}
                className="bg-amber-500 text-black hover:bg-amber-400"
              >
                {isGeneratingAITopic ? (language === 'pl' ? 'Generowanie...' : 'Generating...') : (language === 'pl' ? 'Generuj ✨' : 'Generate ✨')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Import Modal */}"""

content = content.replace(import_modal, ai_gen_modal)

with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)

