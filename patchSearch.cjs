const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

// Find the activeTab === null ? block
const activeTabNullRegex = /\{activeTab === null \? \(\s*<div className="space-y-6">\s*<Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-200\/50">[\s\S]*?<\/Card>\s*\{\(searchQuery\.trim\(\) !== '' \|\| roleFilter !== 'all'\) \? \([\s\S]*?\) : \(/;

const replacement = `{activeTab === null ? (
        <div className="space-y-6">
          <div className="flex justify-end gap-2 mb-6">
            <button onClick={() => setShowAIModal(true)} className="px-4 py-2 bg-base-200/50 text-primary border border-primary/50 rounded-lg text-sm font-bold hover:bg-primary/10 transition-colors">
              ✨ AI Lesson Generator
            </button>
            <button onClick={() => setShowCreateStudentModal(true)} className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
              + Dodaj kursanta
            </button>
          </div>
          `;

if (activeTabNullRegex.test(code)) {
    code = code.replace(activeTabNullRegex, replacement);
    fs.writeFileSync('components/admin/AdminPanel.tsx', code);
    console.log("Patched successfully.");
} else {
    console.log("Could not find regex!");
}
