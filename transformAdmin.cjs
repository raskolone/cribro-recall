const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

// The strategy: we extract specific blocks, then piece them together.
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
const tilesContent = tilesMatch[0].replace(/\)\}/, '');

const tabContentStart = code.indexOf("{activeTab === 'stats' && (");

// Now we build the new render
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
                  Wróć do panelu
                </button>
                <h2 className="text-xl font-bold">
                  {activeTab === 'profile' && 'Profile kursantów'}
                  {activeTab === 'stats' && 'Statystyki'}
                  {activeTab === 'history' && 'Historia'}
                  {activeTab === 'tests' && 'Testy'}
                  {activeTab === 'vocabulary' && 'Słownictwo'}
                </h2>
              </div>
              ${topBarContent}
              ${userListContent}
            </div>
          ) : (
            <div>
              ${userHeaderContent}
              <div className="mb-6 flex items-center gap-4">
                <h2 className="text-xl font-bold">
                  {activeTab === 'stats' && 'Statystyki'}
                  {activeTab === 'history' && 'Historia'}
                  {activeTab === 'profile' && 'Profil kursanta'}
                  {activeTab === 'tests' && 'Testy'}
                  {activeTab === 'vocabulary' && 'Słownictwo'}
                  {activeTab === 'contact' && 'Kontakt'}
                </h2>
              </div>
`;

// we need to replace the content between 
// <h1 className="text-2xl font-extrabold tracking-tight mb-6">Teacher Panel</h1>
// and {activeTab === 'stats' && (
const splitStart = '<h1 className="text-2xl font-extrabold tracking-tight mb-6">Teacher Panel</h1>';
const splitEnd = "{activeTab === 'stats' && (";

const index1 = code.indexOf(splitStart);
const index2 = code.indexOf(splitEnd);

if (index1 !== -1 && index2 !== -1) {
    const before = code.slice(0, index1);
    const after = code.slice(index2);
    
    // the newRender contains splitStart, so we don't duplicate it.
    // Wait, newRender contains <div className="space-y-6"> which is BEFORE splitStart.
    // Let's adjust splitStart to be <div className="space-y-6">\n      <h1 className="text-2xl font-extrabold tracking-tight mb-6">Teacher Panel</h1>
    
    // Actually, I'll just replace the whole block manually with string slices.
}

console.log("Found matches:");
console.log("TopBar:", !!topBarMatch);
console.log("UserList:", !!userListMatch);
console.log("UserHeader:", !!userHeaderMatch);
console.log("ActiveTabHeader:", !!activeTabHeaderMatch);
console.log("Tiles:", !!tilesMatch);

