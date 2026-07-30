const fs = require('fs');

// Fix 1: AdminPanel.tsx 
let adminPanel = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
adminPanel = adminPanel.replace(
  '<h4 className="font-bold text-lg">{set.title || set.name}</h4>',
  '<h4 className="font-bold text-lg">{set.title || (set as any).name}</h4>'
);
fs.writeFileSync('components/admin/AdminPanel.tsx', adminPanel);

// Fix 2: TopicDatabaseScreen.tsx
let topicDb = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf-8');
topicDb = topicDb.replace(
  'const allWords = vocabSnap.docs.map(d => ({id: d.id, ...d.data()}));',
  'const allWords = vocabSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];'
);
fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', topicDb);

console.log("Patches applied.");
