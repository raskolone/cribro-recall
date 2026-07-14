const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
const startSplit = 'return (';
const index1 = code.indexOf(startSplit);
const startRest = code.indexOf("{activeTab === 'stats' && (");
const middle = code.slice(index1, startRest);

let openBrace = 0, closeBrace = 0, openParen = 0, closeParen = 0;
let inString = false, stringChar = '';
for (let i=0; i<middle.length; i++) {
  const c = middle[i];
  if ((c === '"' || c === "'" || c === '\`') && middle[i-1] !== '\\') {
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
console.log('MIDDLE:', { diffBrace: openBrace - closeBrace, diffParen: openParen - closeParen });

const rest = code.slice(startRest, code.indexOf("{/* Delete User Modal */}"));
openBrace = closeBrace = openParen = closeParen = 0;
inString = false; stringChar = '';
for (let i=0; i<rest.length; i++) {
  const c = rest[i];
  if ((c === '"' || c === "'" || c === '\`') && rest[i-1] !== '\\') {
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
console.log('REST:', { diffBrace: openBrace - closeBrace, diffParen: openParen - closeParen });
