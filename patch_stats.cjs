const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const target = `<div ref={tabContentRef}>
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {userStats ? (`;

const replacement = `<div ref={tabContentRef}>
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                  <div className="text-sm text-content-muted mb-2 font-mono uppercase">Ilość Logowań</div>
                  <div className="text-4xl font-display font-bold text-white">{selectedUser.loginCount || 0}</div>
                </div>
                <div className="bg-base-200/50 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                  <div className="text-sm text-content-muted mb-2 font-mono uppercase">Ostatnie Logowanie</div>
                  <div className="text-2xl font-display font-bold text-primary">{selectedUser.lastLoginDate ? new Date(selectedUser.lastLoginDate).toLocaleString() : 'Nigdy'}</div>
                </div>
              </div>
              {userStats ? (`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('components/admin/AdminPanel.tsx', code);
  console.log('patched');
} else {
  console.log('target not found');
}
