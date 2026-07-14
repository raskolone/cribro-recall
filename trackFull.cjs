const fs = require('fs');
const lines = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8').split('\n');

let bp = 0;
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '(') bp++;
    if (line[j] === ')') bp--;
  }
  console.log(i + 1, bp, line.substring(0, 30));
}
