const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardEditScreen.tsx', 'utf8');

const additionalHtml = `
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
                    <span className="text-sm font-medium">Google Drive</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleFormatTextWithAI} disabled={!importText.trim() || isFormattingWithAI} variant="secondary" className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 hover:text-white border-transparent">
                  {isFormattingWithAI ? '...' : (language === 'pl' ? 'Kosmetyka AI (Flashlight) ✨' : 'Clean up with AI ✨')}
                </Button>
              </div>
`;

code = code.replace(
  /<div className="flex items-center gap-4 pt-4 border-t border-base-300">[\s\S]*?<\/div>\s*<\/label>\s*<\/div>/,
  additionalHtml
);

const driveModalStr = `
      {showDriveModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 md:p-6 overflow-y-auto">
          <div className="bg-base-100 p-6 rounded-xl w-full max-w-2xl border border-white/10 shadow-2xl relative my-auto">
            <h3 className="text-xl font-bold mb-4">Wybierz plik z Google Drive</h3>
            {driveError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-4 text-sm">
                {driveError}
              </div>
            )}
            {driveLoading ? (
              <div className="text-center p-8 text-content-muted">Ładowanie plików...</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {driveFiles.map(file => (
                  <div key={file.id} onClick={() => processDriveFile(file)} className="p-3 bg-base-200/50 hover:bg-base-200 rounded-lg cursor-pointer flex justify-between items-center border border-white/5 transition-colors">
                    <span className="font-medium text-sm text-white truncate max-w-[80%]">{file.name}</span>
                    <span className="text-xs text-content-muted">{file.mimeType.includes('pdf') ? 'PDF' : (file.mimeType.includes('document') ? 'DOC' : 'TXT')}</span>
                  </div>
                ))}
                {driveFiles.length === 0 && <div className="text-center text-content-muted">Brak odpowiednich plików.</div>}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setShowDriveModal(false)}>Anuluj</Button>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  "        </div>\n      )}\n    </div>",
  "        </div>\n      )}\n" + driveModalStr + "\n    </div>"
);

fs.writeFileSync('components/flashcards/FlashcardEditScreen.tsx', code);
