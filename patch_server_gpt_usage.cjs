const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// grade-test
code = code.replace(
  "const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;",
  `
  const openaiResult = await callOpenAIServerFallback(prompt, "Jesteś nauczycielem języka angielskiego. Zwróć wyłącznie poprawny JSON z polami score (number) i feedback (string).", true);
  if (openaiResult) {
    try {
      const match = openaiResult.match(/\\{[\\s\\S]*\\}/);
      if (match) {
        return res.json(JSON.parse(match[0]));
      }
    } catch(e) {}
  }
  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;`
);

// generate-test
code = code.replace(
  "const ai = new GoogleGenAI({ apiKey });",
  `
  const openaiResult = await callOpenAIServerFallback(prompt, "You are a test generator.", true);
  if (openaiResult) {
    try {
      const match = openaiResult.match(/\\[[\\s\\S]*\\]/);
      if (match) {
         return res.json(JSON.parse(match[0]));
      }
    } catch(e) {}
  }
  const ai = new GoogleGenAI({ apiKey });`
);

// import-lessons-batch
code = code.replace(
  "const ai = new GoogleGenAI({ apiKey });",
  `
  const openaiResult = await callOpenAIServerFallback(prompt, "You are an assistant.", true);
  if (openaiResult) {
    try {
      const match = openaiResult.match(/\\{[\\s\\S]*\\}/);
      if (match) {
         return res.json(JSON.parse(match[0]));
      }
    } catch(e) {}
  }
  const ai = new GoogleGenAI({ apiKey });`
);

// lesson-summary
code = code.replace(
  "const ai = new GoogleGenAI({ apiKey });",
  `
  const openaiResult = await callOpenAIServerFallback(prompt, "You are an assistant.", true);
  if (openaiResult) {
    try {
      const match = openaiResult.match(/\\{[\\s\\S]*\\}/);
      if (match) {
         return res.json(JSON.parse(match[0]));
      }
    } catch(e) {}
  }
  const ai = new GoogleGenAI({ apiKey });`
);

// student-stats-summary
code = code.replace(
  "const ai = new GoogleGenAI({ apiKey });",
  `
  const openaiResult = await callOpenAIServerFallback(prompt, "You are an assistant.", true);
  if (openaiResult) {
    try {
      const match = openaiResult.match(/\\{[\\s\\S]*\\}/);
      if (match) {
         return res.json(JSON.parse(match[0]));
      }
    } catch(e) {}
  }
  const ai = new GoogleGenAI({ apiKey });`
);

fs.writeFileSync('server.ts', code);
