const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newServerLogic = `
      const { textContent, pdfBase64, driveFile, students } = req.body;
      if (!textContent && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: 'Missing textContent, pdfBase64 or driveFile' });
      }
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const studentsListStr = students ? students.map((s: any) => \`ID: \${s.id} | Imię/Nazwisko: \${s.name} | Poziom: \${s.level} | Opis: \${s.description}\`).join('\\n') : 'Brak bazy kursantów';

      let contents: any[] = [];
      
      if (driveFile) {
        const url = driveFile.mimeType === 'application/pdf' 
          ? \`https://www.googleapis.com/drive/v3/files/\${driveFile.id}?alt=media\`
          : \`https://www.googleapis.com/drive/v3/files/\${driveFile.id}/export?mimeType=text/plain\`;
          
        const res = await fetch(url, { headers: { Authorization: \`Bearer \${driveFile.token}\` } });
        if (!res.ok) throw new Error("Failed to fetch from Google Drive: " + await res.text());
        
        if (driveFile.mimeType === 'application/pdf') {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            contents = [
              {
                inlineData: {
                  data: buffer.toString('base64'),
                  mimeType: 'application/pdf'
                }
              },
              { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nPowyżej znajduje się plik PDF z historią lekcji. Przeanalizuj go.\` }
            ];
        } else {
            const text = await res.text();
            contents = [
              { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTreść historii lekcji (Google Docs / Text):\\n\${text}\` }
            ];
        }
      } else if (pdfBase64) {
`;

code = code.replace(/const \{ textContent, pdfBase64, students \} = req\.body;\s*if \(!textContent && !pdfBase64\) \{\s*return res\.status\(400\)\.json\(\{ error: 'Missing textContent or pdfBase64' \}\);\s*\}\s*const apiKey = process\.env\.GEMINI_API_KEY;\s*if \(!apiKey\) \{\s*return res\.status\(500\)\.json\(\{ error: 'Gemini API key not configured' \}\);\s*\}\s*const ai = new GoogleGenAI\(\{ apiKey \}\);\s*const studentsListStr = students \? students\.map\(\(s: any\) => `ID: \$\{s\.id\} \| Imię\/Nazwisko: \$\{s\.name\} \| Poziom: \$\{s\.level\} \| Opis: \$\{s\.description\}`\)\.join\('\\n'\) : 'Brak bazy kursantów';\s*let contents: any\[\] = \[\];\s*if \(pdfBase64\) \{/, newServerLogic.trim());

fs.writeFileSync('server.ts', code);
console.log('patched server drive');
