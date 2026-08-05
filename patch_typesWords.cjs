const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf8');

code = code.replace(
  "setDisplayName?: string;\n}",
  "setDisplayName?: string;\n  wordsUsed?: string[];\n}"
);
fs.writeFileSync('types.ts', code);
