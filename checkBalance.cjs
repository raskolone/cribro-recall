const fs = require('fs');
const lines = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8').split('\n');

let balanceP = 0;
let balanceB = 0;

for (let i = 208; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '(') balanceP++;
    if (line[j] === ')') balanceP--;
    if (line[j] === '{') balanceB++;
    if (line[j] === '}') balanceB--;
  }
}
console.log('Balance Parentheses:', balanceP);
console.log('Balance Braces:', balanceB);
