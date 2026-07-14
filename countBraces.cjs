const fs = require('fs');
const code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

let openBrace = 0;
let closeBrace = 0;
let openParen = 0;
let closeParen = 0;

// simple count excluding strings (very naive)
let inString = false;
let stringChar = '';
for (let i=0; i<code.length; i++) {
  const c = code[i];
  if ((c === '"' || c === "'" || c === '\`') && code[i-1] !== '\\') {
    if (!inString) {
      inString = true;
      stringChar = c;
    } else if (c === stringChar) {
      inString = false;
    }
  }
  
  if (!inString) {
    if (c === '{') openBrace++;
    if (c === '}') closeBrace++;
    if (c === '(') openParen++;
    if (c === ')') closeParen++;
  }
}

console.log({ openBrace, closeBrace, openParen, closeParen });
console.log('Diff brace:', openBrace - closeBrace);
console.log('Diff paren:', openParen - closeParen);
