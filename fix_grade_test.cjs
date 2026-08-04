const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "        const ai = new GoogleGenAI({ apiKey });",
  `      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in environment variables.' });
      
      const ai = new GoogleGenAI({ apiKey });`
);

fs.writeFileSync('server.ts', code);
