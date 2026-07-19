import fs from 'fs';

// Patch AdminPanel.tsx
let adminContent = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
adminContent = adminContent.replace(
  "const email = normalizeUsername(newStudentUsername) + '@student.cribro.app';",
  "const email = normalizeUsername(newStudentUsername) + '@student.vocabboost.com';"
);
adminContent = adminContent.replace(
  /<div className="font-mono text-lg">\{\`\$\{normalizeUsername\(newStudentUsername\)\}@student\.cribro\.app\`\}<\/div>/g,
  '<div className="font-mono text-lg">{normalizeUsername(newStudentUsername)}</div>'
);
adminContent = adminContent.replace(/u\.email/g, 'u.username'); // for search
adminContent = adminContent.replace(/\{selectedUser\.email\}/g, '{selectedUser.username}');
fs.writeFileSync('components/admin/AdminPanel.tsx', adminContent);

// Patch TeacherQuickAccess.tsx
let quickAccess = fs.readFileSync('components/dashboard/TeacherQuickAccess.tsx', 'utf-8');
quickAccess = quickAccess.replace(/u\.email/g, 'u.username');
fs.writeFileSync('components/dashboard/TeacherQuickAccess.tsx', quickAccess);

// Patch SettingsScreen.tsx
let settingsScreen = fs.readFileSync('components/settings/SettingsScreen.tsx', 'utf-8');
settingsScreen = settingsScreen.replace(/\{user\?\.email\}/g, '{user?.username}');
fs.writeFileSync('components/settings/SettingsScreen.tsx', settingsScreen);

// Patch AuthScreen.tsx text
let authScreen = fs.readFileSync('components/auth/AuthScreen.tsx', 'utf-8');
authScreen = authScreen.replace('Email or Username (Students)', 'Nazwa użytkownika (Login)');
authScreen = authScreen.replace('you@example.com or username', 'np. janek123');
fs.writeFileSync('components/auth/AuthScreen.tsx', authScreen);

console.log("Domains and emails patched");
