import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

# 1. Move buttons to the top bar
top_bar_search = """        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={async () => { await handleManualSave(); onBack(); }}>
            {language === 'pl' ? 'Zapisz' : 'Save'}
          </Button>"""

top_bar_replace = """        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> {language === 'pl' ? 'Importuj z AI' : 'Import with AI'}
          </button>
          <button 
            onClick={() => setIsAIGenModalOpen(true)}
            className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> {language === 'pl' ? 'Wygeneruj z tematu AI' : 'Generate from topic AI'}
          </button>

          <Button variant="secondary" onClick={async () => { await handleManualSave(); onBack(); }}>
            {language === 'pl' ? 'Zapisz' : 'Save'}
          </Button>"""

if top_bar_search in content:
    content = content.replace(top_bar_search, top_bar_replace)
else:
    print("Could not find top bar")

# 2. Remove buttons below the title/desc
buttons_below_search = """        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="text-sm font-medium text-content-muted hover:text-white transition-colors flex items-center gap-2"
          >
            <span>+</span> {language === 'pl' ? 'Importuj tekst (CSV)' : 'Import text (CSV)'}
          </button>
          <button 
            onClick={() => setIsAIGenModalOpen(true)}
            className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> {language === 'pl' ? 'Wygeneruj z tematu (AI)' : 'Generate from topic (AI)'}
          </button>
        </div>"""

if buttons_below_search in content:
    content = content.replace(buttons_below_search, "")
else:
    print("Could not find buttons below title")

with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)
