const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');
file = file.replace(
  "tl=${lang.startsWith('en') ? lang : 'en'}&client=tw-ob",
  "tl=${lang.startsWith('en') ? 'en' : (lang === 'pl' ? 'pl' : lang)}&client=tw-ob"
);
fs.writeFileSync('server.ts', file);
