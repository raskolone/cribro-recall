const fs = require('fs');
const lines = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8').split('\n');

let b = 0;
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') b++;
    if (line[j] === '}') b--;
  }
}
console.log('Balance Braces Full:', b);
