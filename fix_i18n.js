const fs = require('fs');
let code = fs.readFileSync('i18n.ts', 'utf8');

code = code.replace(
  "const savedLang = localStorage.getItem('app_language') || 'pl';",
  `let savedLang = 'pl';
try {
  savedLang = localStorage.getItem('app_language') || 'pl';
} catch (e) {
  console.warn('localStorage access denied, falling back to default language');
}`
);

code = code.replace(
  "localStorage.setItem('app_language', lng);",
  `try {
    localStorage.setItem('app_language', lng);
  } catch (e) {
    console.warn('localStorage access denied');
  }`
);

fs.writeFileSync('i18n.ts', code);
