import re

with open('components/flashcards/FlashcardSetsScreen.tsx', 'r') as f:
    content = f.read()

# 1. Rename "Pozostałe słownictwo" to "Słownictwo prywatne"
content = content.replace("📝 {language === 'pl' ? 'Pozostałe słownictwo' : 'Other Vocabulary'}", "📝 {language === 'pl' ? 'Słownictwo prywatne' : 'Private Vocabulary'}")

# 2. Add state variables and handleBulkImport
state_anchor = "const [isLoadingPreview, setIsLoadingPreview] = useState(false);"
state_addition = """const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);"""
content = content.replace(state_anchor, state_addition)

saveflashcards_anchor = "const { getFlashcards } = useFlashcards();"
saveflashcards_addition = "const { getFlashcards, saveFlashcards } = useFlashcards();"
content = content.replace(saveflashcards_anchor, saveflashcards_addition)

# Add handleBulkImport function
handle_preview_anchor = "const handlePreviewSet = async (setId: string) => {"
handle_bulk_import = """const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    try {
      const { generateFlashcardsFromText } = await import('../../services/geminiService');
      const generated = await generateFlashcardsFromText(importText, 'en', language);
      
      if (generated && generated.length > 0) {
        const setId = await createSet({
          title: language === 'pl' ? 'Zaimportowane Słownictwo' : 'Imported Vocabulary',
          description: language === 'pl' ? 'Wygenerowane z tekstu' : 'Generated from text',
          isPublic: false
        });
        
        const cardsToSave = generated.map((card: any) => ({
          front: card.term,
          back: card.definition,
          example: card.context || ''
        }));
        await saveFlashcards(setId, cardsToSave);
        
        setIsImportModalOpen(false);
        setImportText('');
        onEditSet(setId);
      } else {
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek z tego tekstu.' : 'Failed to generate vocabulary from this text.');
      }
    } catch (error) {
      console.error('Import failed', error);
      alert(language === 'pl' ? 'Wystąpił błąd podczas importu.' : 'Failed to import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handlePreviewSet = async (setId: string) => {"""
content = content.replace(handle_preview_anchor, handle_bulk_import)

# 3. Add UI Button
header_anchor = """<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{language === 'pl' ? 'Moje Listy Słów' : 'My Word Lists'}</h1>
        <Button onClick={handleCreateNewSet} isLoading={isCreating} className="shadow-lg shadow-primary/20">
          + {language === 'pl' ? 'Stwórz nowy zestaw' : 'Create new set'}
        </Button>
      </div>"""

header_new = """<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{language === 'pl' ? 'Moje Listy Słów' : 'My Word Lists'}</h1>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setIsImportModalOpen(true)} variant="secondary" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20">
            {language === 'pl' ? 'Importuj z tekstu (AI)' : 'Import from text (AI)'}
          </Button>
          <Button onClick={handleCreateNewSet} isLoading={isCreating} className="shadow-lg shadow-primary/20">
            + {language === 'pl' ? 'Stwórz nowy zestaw' : 'Create new set'}
          </Button>
        </div>
      </div>"""
content = content.replace(header_anchor, header_new)

# 4. Add the Modal JSX at the end before closing div
modal_anchor = "{setToDelete && ("
modal_jsx = """{isImportModalOpen && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-2xl border-emerald-500/20 bg-base-200/90 backdrop-blur-md">
            <h3 className="text-xl font-bold mb-2 text-emerald-400">
              {language === 'pl' ? 'Masowy import słówek (AI)' : 'Bulk Import (AI)'}
            </h3>
            <p className="text-sm text-content-muted mb-4">
              {language === 'pl' 
                ? 'Wklej tekst zawierający słówka. Nasz model AI automatycznie je posortuje, przetłumaczy i utworzy z nich listę w sekcji "Słownictwo prywatne".' 
                : 'Paste text containing vocabulary. Our AI model will automatically sort, translate, and create a list in the "Private Vocabulary" section.'}
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={language === 'pl' ? 'Wklej tekst tutaj...' : 'Paste text here...'}
              className="w-full h-48 bg-base-300/50 border border-white/10 rounded-xl p-4 text-sm resize-none focus:border-emerald-500/50 outline-none mb-4"
              disabled={isImporting}
            />
            <div className="flex justify-end gap-3">
              <Button onClick={() => setIsImportModalOpen(false)} variant="secondary" disabled={isImporting}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button onClick={handleBulkImport} isLoading={isImporting} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30">
                ✨ {language === 'pl' ? 'Generuj słówka' : 'Generate flashcards'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {setToDelete && ("""
content = content.replace(modal_anchor, modal_jsx)

with open('components/flashcards/FlashcardSetsScreen.tsx', 'w') as f:
    f.write(content)

