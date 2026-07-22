const fs = require('fs');

// Fix AdminPanel.tsx
let adminPanel = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');
adminPanel = adminPanel.replace(
  /const tasksList = tasksSnapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/g,
  "const tasksList = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));"
);
fs.writeFileSync('components/admin/AdminPanel.tsx', adminPanel);
console.log('Fixed AdminPanel.tsx');

// Fix AIExerciseGeneratorScreen.tsx
let aiGen = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');
aiGen = aiGen.replace(
  /const tasks = snap\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/g,
  "const tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));"
);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', aiGen);
console.log('Fixed AIExerciseGeneratorScreen.tsx');
