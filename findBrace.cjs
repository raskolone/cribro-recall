const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
const index1 = code.indexOf('return (');
const before = code.slice(0, index1);

let openBrace = 0, closeBrace = 0;
let lines = before.split('\n');

lines.forEach((line, i) => {
  let inString = false, stringChar = '';
  for (let j=0; j<line.length; j++) {
    const c = line[j];
    if ((c === '"' || c === "'" || c === '\`') && line[j-1] !== '\\') {
      if (!inString) { inString = true; stringChar = c; }
      else if (c === stringChar) { inString = false; }
    }
    if (!inString) {
      if (c === '{') openBrace++;
      if (c === '}') closeBrace++;
    }
  }
  if (openBrace - closeBrace > 1) {
    console.log('Line', i+1, 'diff is', openBrace - closeBrace);
  }
});
