const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const regex = /<div className="mb-4">\s*<button\s*onClick=\{\(\) => \{\s*setSelectedUser\(null\);\s*if \(onUserSelect\) onUserSelect\(null\);\s*setPracticeLogs\(\[\]\);\s*setLessonRecords\(\[\]\);\s*\}\}\s*className="text-sm font-bold text-content-muted hover:text-white flex items-center gap-2 transition-colors"\s*>\s*<svg[\s\S]*?<\/svg>\s*Wróć do listy kursantów\s*<\/button>\s*<\/div>/;

const replacement = `<div className="mb-4 flex items-center gap-6">
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    if (onUserSelect) onUserSelect(null);
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
                    if (onUserSelect) onUserSelect(null);
                    if (onViewChange) onViewChange('admin');
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

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('components/admin/AdminPanel.tsx', code);
    console.log("Patched successfully.");
} else {
    console.log("Could not find regex!");
}
