const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
let lines = code.split('\n');

let openParen = 0, closeParen = 0;
let inString = false, stringChar = '';

lines.forEach((line, i) => {
  for (let j=0; j<line.length; j++) {
    const c = line[j];
    if ((c === '"' || c === "'" || c === '\`') && line[j-1] !== '\\') {
      if (!inString) { inString = true; stringChar = c; }
      else if (c === stringChar) { inString = false; }
    }
    if (!inString) {
      if (c === '(') openParen++;
      if (c === ')') closeParen++;
    }
  }
  console.log(i+1, openParen - closeParen);
});
