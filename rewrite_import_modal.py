import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

old_import_modal = r"\{isImportModalOpen && \(\s*<div className=\"fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4\">\s*<Card className=\"w-full max-w-3xl max-h-\[90vh\] flex flex-col\">.*?\{showDriveModal && \("

new_import_modal = """{isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-400" />
                {language === 'pl' ? 'Importuj z AI' : 'Import with AI'}
              </h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-content-muted hover:text-white text-2xl">{i18n.t("&times;")}</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div>
                <p className="text-content-muted mb-4">
                  {language === 'pl' 
                    ? 'Wklej dowolną listę słówek, tekst lub artykuł. Sztuczna inteligencja przeanalizuje go i automatycznie stworzy dla Ciebie gotowy zestaw fiszek.' 
                    : 'Paste any vocabulary list, text, or article. Artificial intelligence will analyze it and automatically create a ready flashcard set for you.'}
                </p>
                
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{language === 'pl' ? 'Język pojęcia:' : 'Term language:'}</label>
                    <select 
                      value={importTermLang} 
                      onChange={(e) => setImportTermLang(e.target.value)}
                      className="bg-base-200/40 backdrop-blur-md border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                    >
                      {LANGUAGES.map((l: any) => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{language === 'pl' ? 'Język definicji:' : 'Def language:'}</label>
                    <select 
                      value={importDefLang} 
                      onChange={(e) => setImportDefLang(e.target.value)}
                      className="bg-base-200/40 backdrop-blur-md border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                    >
                      {LANGUAGES.map((l: any) => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full h-64 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-lg p-4 focus:outline-none focus:border-primary font-mono text-sm resize-y"
                  placeholder={language === 'pl' ? 'Wklej tutaj tekst do analizy przez AI...' : 'Paste text for AI analysis here...'}
                />
              </div>
              
              <div className="flex items-center gap-4 pt-4 border-t border-base-300">
                <label className="flex-1">
                  <div className="border-2 border-dashed border-base-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:text-primary transition-colors">
                    <span className="text-sm font-medium">{language === 'pl' ? 'Wybierz plik z tekstem (.txt)' : 'Choose text file (.txt)'}</span>
                    <input type="file" accept=".txt,.csv,.tsv" onChange={handleFileUpload} className="hidden" />
                  </div>
                </label>
                <div className="flex-1">
                  <div onClick={fetchDriveFiles} className="border-2 border-dashed border-base-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    <span className="text-sm font-medium">{i18n.t("Google Drive")}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-8">
              <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleImportWithAI} 
                disabled={!importText.trim() || isImportingWithAI}
                className="bg-amber-500 text-black hover:bg-amber-400 border-transparent"
              >
                {isImportingWithAI ? (language === 'pl' ? 'Analizowanie...' : 'Analyzing...') : (language === 'pl' ? 'Generuj z AI ✨' : 'Generate with AI ✨')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showDriveModal && ("""

# replace regex
content = re.sub(old_import_modal, new_import_modal, content, flags=re.DOTALL)

with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)

