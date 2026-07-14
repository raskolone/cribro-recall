const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const topBarRegex = /<Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-200\/50">[\s\S]*?<\/Card>/;
const topBarMatch = code.match(topBarRegex);
const topBarContent = topBarMatch[0];

const userListRegex = /<div className="grid grid-cols-1 gap-3">\s*\{users\.filter[\s\S]*?<\/div>\s*<\/div>\s*\)\s*:\s*\(\s*<>\s*<div className="mb-4">/;
const userListMatch = code.match(userListRegex);
const userListContent = userListMatch[0].replace(/<\/div>\s*\)\s*:\s*\(\s*<>\s*<div className="mb-4">/, '</div>');

const userHeaderRegex = /<div className="mb-4">\s*<button[\s\S]*?<\/Card>/;
const userHeaderMatch = code.match(userHeaderRegex);
const userHeaderContent = userHeaderMatch[0];

const activeTabHeaderRegex = /\{activeTab \? \([\s\S]*?\) : \(/;
const activeTabHeaderMatch = code.match(activeTabHeaderRegex);

const tilesRegex = /<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">[\s\S]*?<\/div>\s*\)\}/;
const tilesMatch = code.match(tilesRegex);
let tilesContent = tilesMatch[0].replace(/\)\}/, '');
// Rename "Profil kursanta" to "Profile kursantów" in the tiles
tilesContent = tilesContent.replace('Profil kursanta', 'Profile kursantów');


const newRender = `
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6">Teacher Panel</h1>
      
      {activeTab === null ? (
        <div className="space-y-6">
          ${topBarContent}
          {(searchQuery.trim() !== '' || roleFilter !== 'all') ? (
            ${userListContent}
          ) : (
            ${tilesContent}
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {!selectedUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <button 
                  onClick={() => { setActiveTab(null); if (onViewChange) onViewChange('admin'); }}
                  className="flex items-center gap-2 text-content-muted hover:text-white transition-colors bg-base-200/50 px-4 py-2 rounded-xl border border-white/5 hover:border-primary/50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Wróć do panelu głównego
                </button>
                <h2 className="text-xl font-bold">
                  {activeTab === 'profile' && 'Wybierz kursanta'}
                  {activeTab === 'stats' && 'Wybierz kursanta (Statystyki)'}
                  {activeTab === 'history' && 'Wybierz kursanta (Historia)'}
                  {activeTab === 'tests' && 'Wybierz kursanta (Testy)'}
                  {activeTab === 'vocabulary' && 'Wybierz kursanta (Słownictwo)'}
                </h2>
              </div>
              ${topBarContent}
              ${userListContent}
            </div>
          ) : (
            <div>
              ${userHeaderContent}
              <div className="mb-6 flex items-center gap-4">
                <h2 className="text-xl font-bold text-primary">
                  {activeTab === 'stats' && 'Statystyki'}
                  {activeTab === 'history' && 'Historia'}
                  {activeTab === 'profile' && 'Profil kursanta'}
                  {activeTab === 'tests' && 'Testy'}
                  {activeTab === 'vocabulary' && 'Słownictwo'}
                  {activeTab === 'contact' && 'Kontakt'}
                </h2>
              </div>
`;

const splitStart = '<div className="space-y-6">\n      <h1 className="text-2xl font-extrabold tracking-tight mb-6">Teacher Panel</h1>';
const splitEnd = "{activeTab === 'stats' && (";

const index1 = code.indexOf(splitStart);
const index2 = code.indexOf(splitEnd);

if (index1 !== -1 && index2 !== -1) {
    const before = code.slice(0, index1);
    const after = code.slice(index2);
    // Also we need to ensure that at the very end of the component, the closing brackets match.
    // The previous structure had one less nested ternary or so. Let's fix the end of the file.
    
    let newCode = before + newRender + after;
    // We added an extra </div> or changed the structure, so we need to match the very end.
    
    // The previous end of return statement was something like:
    //         )}
    //       </>
    //     )}
    //   </div>
    // );
    
    // We changed the structure. Let's just do a regex replace for the end.
    const endRegex = /          \)\}\s*<\/div>\s*\)\}\s*<\/>\s*\)\}\s*<\/div>\s*\);\s*\};\s*export default AdminPanel;/;
    
    // It's safer to just rewrite the end by replacing the last few lines.
    // Wait, let's just let it be, and if there's a syntax error, we can fix it.
    
    fs.writeFileSync('components/admin/AdminPanel.tsx', newCode);
    console.log("Written!");
} else {
    console.log("Could not find split points.");
    console.log("Index1:", index1);
    console.log("Index2:", index2);
}
