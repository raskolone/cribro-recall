const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

// I will extract everything BEFORE "return (" and AFTER the end of the component
const startSplit = 'return (';
const index1 = code.indexOf(startSplit);
const before = code.slice(0, index1 + startSplit.length);

// Now let's extract the modals at the end.
const endSplit = '{/* Change Password Modal */}';
const index2 = code.indexOf(endSplit);
const after = code.slice(index2);

// the middle part needs to be rewritten properly using the actual React variables.
// Let's generate it correctly.

const middle = `
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6">Teacher Panel</h1>

      {activeTab === null ? (
        <div className="space-y-6">
          <Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-200/50">
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
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowAIModal(true)} variant="secondary" className="border-primary/50 text-primary hover:bg-primary/10">
                  ✨ AI Lesson Generator
                </Button>
                <Button size="sm" onClick={() => setShowCreateStudentModal(true)}>+ Add Student</Button>
              </div>
            </div>
          </Card>

          {(searchQuery.trim() !== '' || roleFilter !== 'all') ? (
            <div className="grid grid-cols-1 gap-3">
              {users.filter(u => {
                const searchStr = \`\${u.firstName || ''} \${u.lastName || ''} \${u.email} \${u.username}\`.toLowerCase();
                const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
                const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                return matchesSearch && matchesRole;
              }).map(u => (
                <div
                  key={u.id}
                  onClick={() => { handleSelectUser(u); setActiveTab('profile'); }}
                  className="bg-base-200 border border-white/5 p-4 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-base-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div>
                    <div className="font-bold text-lg group-hover:text-primary transition-colors">
                      {u.firstName || u.lastName ? \`\${u.firstName || ''} \${u.lastName || ''}\`.trim() : u.username}
                    </div>
                    <div className="text-sm text-content-muted">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={\`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider \${u.role === 'admin' ? 'bg-red-500/10 text-red-500' : u.role === 'admin_student' ? 'bg-purple-500/10 text-purple-500' : 'bg-primary/10 text-primary'}\`}>
                      {u.role === 'admin_student' ? 'Admin + Kursant' : u.role === 'admin' ? 'Admin' : 'Kursant'}
                    </span>
                    <div className="text-content-muted group-hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <button onClick={() => handleTabChange('profile')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h3 className="font-bold text-lg">Profile kursantów</h3>
              </button>
              <button onClick={() => handleTabChange('stats')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="font-bold text-lg">Statystyki</h3>
              </button>
              <button onClick={() => handleTabChange('history')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="font-bold text-lg">Historia</h3>
              </button>
              <button onClick={() => handleTabChange('tests')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
                <h3 className="font-bold text-lg">Testy</h3>
              </button>
              <button onClick={() => handleTabChange('vocabulary')} className="flex flex-col items-center justify-center p-8 bg-base-200/50 rounded-2xl border border-white/5 hover:border-primary/50 hover:bg-base-200 transition-all duration-300 group">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                </div>
                <h3 className="font-bold text-lg">Słownictwo</h3>
              </button>
            </div>
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
              
              <Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-200/50">
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
              </Card>

              <div className="grid grid-cols-1 gap-3">
                {users.filter(u => {
                  const searchStr = \`\${u.firstName || ''} \${u.lastName || ''} \${u.email} \${u.username}\`.toLowerCase();
                  const matchesSearch = searchStr.includes(searchQuery.toLowerCase());
                  const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                  return matchesSearch && matchesRole;
                }).map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className="bg-base-200 border border-white/5 p-4 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-base-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div>
                      <div className="font-bold text-lg group-hover:text-primary transition-colors">
                        {u.firstName || u.lastName ? \`\${u.firstName || ''} \${u.lastName || ''}\`.trim() : u.username}
                      </div>
                      <div className="text-sm text-content-muted">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={\`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider \${u.role === 'admin' ? 'bg-red-500/10 text-red-500' : u.role === 'admin_student' ? 'bg-purple-500/10 text-purple-500' : 'bg-primary/10 text-primary'}\`}>
                        {u.role === 'admin_student' ? 'Admin + Kursant' : u.role === 'admin' ? 'Admin' : 'Kursant'}
                      </span>
                      <div className="text-content-muted group-hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
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
              </div>

              <Card className="bg-base-200/50 mb-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-base-300 flex items-center justify-center font-bold text-3xl text-primary flex-shrink-0 relative group overflow-hidden border border-white/10">
                    {selectedUser.photoURL ? (
                      <img src={selectedUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedUser.firstName ? selectedUser.firstName[0].toUpperCase() : selectedUser.username[0].toUpperCase()
                    )}
                    <div onClick={() => {
                      const newUrl = prompt('Podaj URL do nowego awatara:', selectedUser.photoURL || '');
                      if (newUrl !== null) {
                        const userRef = doc(db, 'users', selectedUser.id);
                        updateDoc(userRef, { photoURL: newUrl }).then(() => {
                          const updated = { ...selectedUser, photoURL: newUrl };
                          setSelectedUser(updated);
                          setUsers(users.map(u => u.id === updated.id ? updated : u));
                        }).catch(err => alert('Błąd: ' + err.message));
                      }
                    }} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-xs text-white">Zmień awatar</span>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedUser.firstName || selectedUser.lastName ? \`\${selectedUser.firstName || ''} \${selectedUser.lastName || ''}\`.trim() : selectedUser.username}
                    </h2>
                    <p className="text-content-muted mt-1">
                      {selectedUser.email}
                      {selectedUser.level && <span className="ml-3 px-2 py-0.5 bg-primary/20 text-primary rounded text-xs uppercase font-bold">{selectedUser.level}</span>}
                    </p>
                    <div className="mt-3 text-sm text-content-muted flex flex-wrap gap-x-6 gap-y-2">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div><span className="font-bold text-white">Rola:</span> {selectedUser.role === 'admin' ? 'Admin' : selectedUser.role === 'admin_student' ? 'Admin + Kursant' : 'Kursant'}</div>
                      <div><span className="font-bold text-white">Logowania:</span> {selectedUser.loginCount || 0}</div>
                      <div><span className="font-bold text-white">Ostatnio:</span> {selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleString() : 'Nigdy'}</div>
                    </div>
                  </div>
                </div>
              </Card>

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

// we need to find where the rest of the tab contents are. 
// It starts with `{activeTab === 'stats' && (`
const restStart = "{activeTab === 'stats' && (";
const indexRest = code.indexOf(restStart);
const rest = code.slice(indexRest, index2); // up to Modals

const fullCode = before + middle + rest + '          </div>\n        </div>\n      )}\n' + after;

fs.writeFileSync('components/admin/AdminPanel.tsx', fullCode);
