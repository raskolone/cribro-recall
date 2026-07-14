const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

// simple naive count
const tags = code.match(/<\/?([a-zA-Z0-9]+)[^>]*>/g) || [];
const counts = {};
tags.forEach(t => {
  const isClosing = t.startsWith('</');
  const tagMatch = t.match(/<\/?([a-zA-Z0-9]+)/);
  if (!tagMatch) return;
  const tag = tagMatch[1];
  
  if (t.endsWith('/>')) return; // self-closing
  
  if (!counts[tag]) counts[tag] = 0;
  if (isClosing) counts[tag]--;
  else counts[tag]++;
});
console.log(counts);
