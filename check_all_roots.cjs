const fs = require('fs');
const files = [
  'components/admin/AdminStatsScreen.tsx',
  'components/admin/AdminDebuggingScreen.tsx',
  'components/admin/TopicDatabaseScreen.tsx',
  'components/tests/StudentTestsScreen.tsx',
  'components/dashboard/LessonHistoryScreen.tsx',
  'components/flashcards/FlashcardSetsScreen.tsx',
  'components/settings/SettingsScreen.tsx',
  'components/dashboard/StudentStatsScreen.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const code = fs.readFileSync(f, 'utf8');
    const m = code.match(/return \(\s*<div([^>]*)>/);
    console.log(f, '=>', m ? m[1] : 'no match');
  }
});
