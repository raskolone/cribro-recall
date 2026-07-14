const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
const startSplit = 'return (';
const index1 = code.indexOf(startSplit);
const startRest = code.indexOf("{activeTab === 'stats' && (");
const middle = code.slice(index1 + startSplit.length, startRest);

let divCount = 0;
const tags = middle.match(/<\/?([a-zA-Z0-9]+)[^>]*>/g) || [];
const counts = {};

tags.forEach(t => {
  const isClosing = t.startsWith('</');
  const tagMatch = t.match(/<\/?([a-zA-Z0-9]+)/);
  if (!tagMatch) return;
  const tag = tagMatch[1];
  if (t.endsWith('/>')) return; 
  if (!counts[tag]) counts[tag] = 0;
  if (isClosing) counts[tag]--;
  else counts[tag]++;
});

console.log(counts);
