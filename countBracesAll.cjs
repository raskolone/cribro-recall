const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
const index1 = code.indexOf('return (');
const index2 = code.indexOf("{/* Delete User Modal */}");

const before = code.slice(0, index1);
const after = code.slice(index2);

function count(str) {
  let openBrace = 0, closeBrace = 0, openParen = 0, closeParen = 0;
  let inString = false, stringChar = '';
  for (let i=0; i<str.length; i++) {
    const c = str[i];
    if ((c === '"' || c === "'" || c === '\`') && str[i-1] !== '\\') {
      if (!inString) { inString = true; stringChar = c; }
      else if (c === stringChar) { inString = false; }
    }
    if (!inString) {
      if (c === '{') openBrace++;
      if (c === '}') closeBrace++;
      if (c === '(') openParen++;
      if (c === ')') closeParen++;
    }
  }
  return { diffBrace: openBrace - closeBrace, diffParen: openParen - closeParen };
}

console.log('BEFORE:', count(before));
console.log('AFTER:', count(after));
