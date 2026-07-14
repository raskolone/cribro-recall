const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const regexToReplace = /<div className="mb-4">\s*<button\s*onClick=\{\(\) => \{\s*setSelectedUser\(null\);\s*if \(onUserSelect\) onUserSelect\(null\);\s*setPracticeLogs\(\[\]\);\s*setLessonRecords\(\[\]\);\s*\}\}\s*className="text-sm font-bold text-content-muted hover:text-white flex items-center gap-2 transition-colors"\s*>\s*<svg[\s\S]*?<\/svg>\s*Wróć do listy kursantów\s*<\/button>\s*<\/div>/;

const replacement = `<div className="mb-4 flex items-center gap-6">
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    if (typeof onUserSelect === 'function') onUserSelect(null);
                    setPracticeLogs([]);
                    setLessonRecords([]);
                  }}
                  className="text-sm font-bold text-content-muted hover:text-white flex items-center gap-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Wróć do listy kursantów
                </button>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setActiveTab(null);
                    if (typeof onUserSelect === 'function') onUserSelect(null);
                    if (typeof onViewChange === 'function') onViewChange('admin');
                    setPracticeLogs([]);
                    setLessonRecords([]);
                  }}
                  className="text-sm font-bold text-content-muted hover:text-white flex items-center gap-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Wróć do menu głównego
                </button>
              </div>`;

if (!regexToReplace.test(code)) {
  console.log("Could not find back button block");
  process.exit(1);
}
code = code.replace(regexToReplace, replacement);

const cardRegex = /<Card className="bg-base-200\/50 mb-6">[\s\S]*?<\/Card>/;
const cardMatch = code.match(cardRegex);
if (cardMatch) {
  const tabsBlock = `
              <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={() => setActiveTab('profile')} className={\`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors \${activeTab === 'profile' ? 'bg-primary text-black' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white'}\`}>Profil</button>
                <button onClick={() => setActiveTab('stats')} className={\`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors \${activeTab === 'stats' ? 'bg-primary text-black' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white'}\`}>Statystyki</button>
                <button onClick={() => setActiveTab('history')} className={\`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors \${activeTab === 'history' ? 'bg-primary text-black' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white'}\`}>Historia</button>
                <button onClick={() => setActiveTab('tests')} className={\`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors \${activeTab === 'tests' ? 'bg-primary text-black' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white'}\`}>Testy</button>
                <button onClick={() => setActiveTab('vocabulary')} className={\`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors \${activeTab === 'vocabulary' ? 'bg-primary text-black' : 'bg-base-200 text-content-muted hover:bg-base-200/80 hover:text-white'}\`}>Słownictwo</button>
              </div>`;
  code = code.replace(cardMatch[0], cardMatch[0] + tabsBlock);
} else {
  console.log("Could not find user card");
  process.exit(1);
}

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('done');
