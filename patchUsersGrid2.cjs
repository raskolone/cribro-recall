const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const regexToReplace = /<div className="grid grid-cols-1 gap-3">\s*\{users\.filter\([\s\S]*?\}\)\.map\(u => \([\s\S]*?\}\)\}\s*<\/div>/;

const replacement = `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.length === 0 && <div className="col-span-full text-center text-content-muted py-8">Ładowanie kursantów lub brak wyników...</div>}
                {users.filter(u => {
                  const searchStr = \`\${u.firstName || ''} \${u.lastName || ''} \${u.email} \${u.username}\`.toLowerCase();
                  const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
                  const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                  return matchesSearch && matchesRole;
                }).map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className="bg-base-200 border border-white/5 p-6 rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-base-200/80 transition-all flex flex-col items-center justify-center gap-4 group text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]"
                  >
                    <div className="w-20 h-20 rounded-full bg-base-300 flex items-center justify-center font-bold text-2xl text-primary overflow-hidden border border-white/10 group-hover:scale-110 transition-transform">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        u.firstName ? u.firstName[0].toUpperCase() : u.username[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-lg group-hover:text-primary transition-colors">
                        {u.firstName || u.lastName ? \`\${u.firstName || ''} \${u.lastName || ''}\`.trim() : u.username}
                      </div>
                      <div className="text-sm text-content-muted mt-1">{u.email}</div>
                    </div>
                    <div className="mt-2">
                      <span className={\`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider \${u.role === 'admin' ? 'bg-red-500/10 text-red-500' : u.role === 'admin_student' ? 'bg-purple-500/10 text-purple-500' : 'bg-primary/10 text-primary'}\`}>
                        {u.role === 'admin_student' ? 'Admin + Kursant' : u.role === 'admin' ? 'Admin' : 'Kursant'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>`;

if (!regexToReplace.test(code)) {
  console.log("Could not find users grid block");
  process.exit(1);
}

code = code.replace(regexToReplace, replacement);
fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('done');
