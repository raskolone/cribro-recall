const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardEditScreen.tsx', 'utf-8');

const target = `      const res = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.document" or mimeType="application/pdf" or mimeType="text/plain"&fields=files(id,name,mimeType)', {`;
const replacement = `      const query = encodeURIComponent("mimeType='application/vnd.google-apps.document' or mimeType='application/pdf' or mimeType='text/plain'");
      const res = await fetch(\`https://www.googleapis.com/drive/v3/files?q=\${query}&fields=files(id,name,mimeType)\`, {`;

code = code.replace(target, replacement);

fs.writeFileSync('components/flashcards/FlashcardEditScreen.tsx', code);
