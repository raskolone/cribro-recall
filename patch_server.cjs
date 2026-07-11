const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldLessonSummary = `  app.post('/api/gemini/lesson-summary', requireFirebaseAdmin, async (req, res) => {
    try {
      const { notes, students } = req.body;
      if (!notes) {
        return res.status(400).json({ error: 'Missing notes' });
      }
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const studentsListStr = students ? students.map((s: any) => \`ID: \${s.id} | Imię/Nazwisko: \${s.name} | Poziom: \${s.level} | Opis: \${s.description}\`).join('\\n') : 'Brak bazy kursantów';

      const promptContext = \`Baza kursantów:\\n\${studentsListStr}\\n\\nTranskrypcja/Notatki ze spotkania:\\n\${notes}\`;`;

const newLessonSummary = `  app.post('/api/gemini/lesson-summary', requireFirebaseAdmin, async (req, res) => {
    try {
      const { notes, pdfBase64, driveFile, students } = req.body;
      if (!notes && !pdfBase64 && !driveFile) {
        return res.status(400).json({ error: 'Missing notes, pdfBase64 or driveFile' });
      }
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const studentsListStr = students ? students.map((s: any) => \`ID: \${s.id} | Imię/Nazwisko: \${s.name} | Poziom: \${s.level} | Opis: \${s.description}\`).join('\\n') : 'Brak bazy kursantów';

      let promptContext: any[] = [];
      
      if (driveFile) {
        const url = driveFile.mimeType === 'application/pdf' 
          ? \`https://www.googleapis.com/drive/v3/files/\${driveFile.id}?alt=media\`
          : \`https://www.googleapis.com/drive/v3/files/\${driveFile.id}/export?mimeType=text/plain\`;
          
        const fetchRes = await fetch(url, { headers: { Authorization: \`Bearer \${driveFile.token}\` } });
        if (!fetchRes.ok) throw new Error("Failed to fetch from Google Drive: " + await fetchRes.text());
        
        if (driveFile.mimeType === 'application/pdf') {
            const arrayBuffer = await fetchRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            promptContext = [
              {
                inlineData: {
                  data: buffer.toString('base64'),
                  mimeType: 'application/pdf'
                }
              },
              { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nPowyżej znajduje się plik PDF z notatkami z lekcji. Przeanalizuj go.\` }
            ];
        } else {
            const text = await fetchRes.text();
            promptContext = [
              { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTranskrypcja/Notatki ze spotkania (Google Docs / Text):\\n\${text}\` }
            ];
        }
      } else if (pdfBase64) {
        promptContext = [
          {
            inlineData: {
              data: pdfBase64.split(',')[1] || pdfBase64,
              mimeType: 'application/pdf'
            }
          },
          { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nPowyżej znajduje się plik PDF z notatkami z lekcji. Przeanalizuj go.\` }
        ];
      } else {
        promptContext = [
          { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTranskrypcja/Notatki ze spotkania:\\n\${notes}\` }
        ];
      }`;

code = code.replace(oldLessonSummary, newLessonSummary);
fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
