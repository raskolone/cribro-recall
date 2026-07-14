const fs = require('fs');
const lines = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8').split('\n');

let balance = 0;
for (let i = lines.length - 1; i >= 0; i--) {
  let line = lines[i];
  for (let j = line.length - 1; j >= 0; j--) {
    if (line[j] === ')') balance++;
    if (line[j] === '}') balance++;
    if (line[j] === '(') balance--;
    if (line[j] === '{') balance--;
    
    if (balance < 0) {
       console.log(`Found unclosed opening bracket at line ${i+1}: ${line}`);
       process.exit(0);
    }
  }
}
