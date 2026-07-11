const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const newBatchImport = `
  const handleBatchImport = async (textContent: string, pdfBase64: string, driveFile?: { id: string, mimeType: string, token: string }) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/gemini/import-lessons-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({
          textContent,
          pdfBase64,
          driveFile,
          students: users.map(u => ({ id: u.id, name: u.firstName || u.username, level: u.level, description: u.description }))
        })
      });

      let result;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('Server returned non-JSON:', text);
        if (response.status === 413) {
           throw new Error('Plik jest zbyt duży (przekroczono limit).');
        } else if (response.status === 504) {
           throw new Error('Przekroczono czas oczekiwania na odpowiedź od AI (Gateway Timeout).');
        } else {
           throw new Error(\`Błąd serwera (\${response.status}): Otrzymano nieprawidłową odpowiedź.\`);
        }
      }

      if (!response.ok) throw new Error(result.error || 'Nieznany błąd API');
`;

code = code.replace(/const handleBatchImport = async \(textContent: string, pdfBase64: string\) => \{\s*try \{\s*const token = await auth\.currentUser\?\.getIdToken\(\);\s*const response = await fetch\('\/api\/gemini\/import-lessons-batch', \{\s*method: 'POST',\s*headers: \{\s*'Content-Type': 'application\/json',\s*'Authorization': `Bearer \$\{token\}`\s*\},\s*body: JSON\.stringify\(\{\s*textContent,\s*pdfBase64,\s*students: users\.map\(u => \(\{ id: u\.id, name: u\.firstName \|\| u\.username, level: u\.level, description: u\.description \}\)\)\s*\}\)\s*\}\);\s*const result = await response\.json\(\);\s*if \(!response\.ok\) throw new Error\(result\.error\);/, newBatchImport.trim());

// Also replace handleBatchImport call in processDriveFile
code = code.replace(/await handleBatchImport\(textContent, pdfBase64\);/g, "await handleBatchImport(textContent, pdfBase64, { id: file.id, mimeType: file.mimeType, token });");

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('patched admin3');
