const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardEditScreen.tsx', 'utf8');

const funcs = `
  const fetchDriveFiles = async () => {
    try {
      setDriveLoading(true);
      setShowDriveModal(true);
      setDriveError(null);
      const token = await connectGoogleDrive();
      const res = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.document" or mimeType="application/pdf" or mimeType="text/plain"&fields=files(id,name,mimeType)', {
        headers: { Authorization: \`Bearer \${token}\` },
      });
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      console.error(err);
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
      const token = await connectGoogleDrive();
      let textContent = '';
      if (file.mimeType === 'application/pdf') {
        alert('PDF not supported here yet. Please use Docs or Text files.');
        return;
      } else if (file.mimeType === 'application/vnd.google-apps.document') {
        const res = await fetch(\`https://www.googleapis.com/drive/v3/files/\${file.id}/export?mimeType=text/plain\`, {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        textContent = await res.text();
      } else {
        const res = await fetch(\`https://www.googleapis.com/drive/v3/files/\${file.id}?alt=media\`, {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        textContent = await res.text();
      }
      setImportText(prev => prev + (prev ? '\\n' : '') + textContent);
      setShowDriveModal(false);
    } catch (err: any) {
      console.error(err);
      alert('Błąd przetwarzania pliku: ' + (err.message || 'Nieznany błąd'));
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
`;

code = code.replace("const handleImportWithAI = async () => {", funcs + "\n  const handleImportWithAI = async () => {");

fs.writeFileSync('components/flashcards/FlashcardEditScreen.tsx', code);
