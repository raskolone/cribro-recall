const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

// The tiles block is:
const tilesRegex = /<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">[\s\S]*?<h3 className="font-bold text-lg">Słownictwo<\/h3>\s*<\/button>\s*<\/div>/;
const tilesMatch = code.match(tilesRegex);
if (!tilesMatch) {
  console.log("Could not find tiles");
  process.exit(1);
}

// First, let's remove everything between {activeTab === null ? ( and ) : (
// Actually, let's just use substring and indexes since regex is tricky with nested ternaries.
const startMarker = '{activeTab === null ? (';
const startIdx = code.indexOf(startMarker);
// We know that the tiles end with </div>\n          )}\n        </div>\n      ) : (\n        <div className="space-y-6">
const endMarker = ') : (\n        <div className="space-y-6">\n          {!selectedUser ? (';
const endIdx = code.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const before = code.substring(0, startIdx);
const after = code.substring(endIdx); // this includes ) : (

const buttonsBlock = `
        <div className="space-y-6">
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setShowAIModal(true)} variant="secondary" className="border-primary/50 text-primary hover:bg-primary/10">
              ✨ AI Lesson Generator
            </Button>
            <Button size="sm" onClick={() => setShowCreateStudentModal(true)}>+ Add Student</Button>
          </div>
`;

const newMainBlock = startMarker + '\n' + buttonsBlock + '\n          ' + tilesMatch[0] + '\n        </div>\n      ';

code = before + newMainBlock + after;

// Now let's fix the profile view search card
const profileCardRegex = /<Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-200\/50">\s*<div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto flex-1">[\s\S]*?<\/Card>/;

const newProfileCard = `<Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-200/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto flex-1">
                  <input
                    type="text"
                    placeholder="Szukaj po imieniu, nazwisku, emailu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:max-w-md bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm"
                  />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full sm:w-48 bg-base-100 border border-base-300 rounded-lg p-2.5 outline-none focus:border-primary/50 text-sm"
                  >
                    <option value="all">Wszystkie role</option>
                    <option value="user">Kursant</option>
                    <option value="admin">Admin</option>
                    <option value="admin_student">Admin + Kursant</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-sm font-mono text-content-muted">Total: {users.filter(u => {
                    const searchStr = \`\${u.firstName || ''} \${u.lastName || ''} \${u.email} \${u.username}\`.toLowerCase();
                    const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
                    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                    return matchesSearch && matchesRole;
                  }).length}</div>
                </div>
              </Card>`;

code = code.replace(profileCardRegex, newProfileCard);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('done');
