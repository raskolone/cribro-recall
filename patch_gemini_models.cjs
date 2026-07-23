const fs = require('fs');
const file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const models = \["gemini-3.5-flash", "gemini-3.1-flash-lite"\];/;
const replace = `const models = ["gemini-3.5-flash", "gemini-3.5-flash-8b", "gemini-3.1-flash-lite", "gemini-3.1-pro"];`;
content = content.replace(regex, replace);

const regex2 = /setTimeout\(\(\) => reject\(new Error\("Request timed out after 15 seconds"\)\), 15000\);/;
const replace2 = `setTimeout(() => reject(new Error("Request timed out after 45 seconds")), 45000);`;
content = content.replace(regex2, replace2);

// Add exponential backoff for 503
const regex3 = /const generateContentWithFallback = async \\(params: any\\) => \\{[\\s\\S]*?throw lastError;\\n\\};/;

// Let's just use replace to re-write generateContentWithFallback
