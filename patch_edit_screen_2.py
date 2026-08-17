import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

# Fix the import button and add the new generate button
old_buttons = """        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="text-sm font-medium text-content-muted hover:text-white transition-colors flex items-center gap-2"
          >
            <span>+</span> {language === 'pl' ? 'Importuj (również z AI)' : 'Import (incl. AI)'}
          </button>
        </div>"""

new_buttons = """        <div className="flex items-center gap-6">
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

if old_buttons in content:
    content = content.replace(old_buttons, new_buttons)
else:
    print("Could not find old_buttons block")

with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)
