const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx.bak', 'utf-8');

// The file has extra lines 1141-1143:
// 1141:                </div>
// 1142:        </div>
// 1143:      )}
// We remove them.
const lines = code.split('\n');
lines.splice(1140, 3); // removes lines 1141, 1142, 1143

code = lines.join('\n');

// Now we need to close the `activeTab === null` ternary properly.
// The `activeTab !== null` block starts at 318:
// 318:      ) : (
// 319:        <div className="space-y-6">
// 320:          {!selectedUser ? (
// and `!selectedUser` ends at 745:
// 745:          )}
// So after line 745, we MUST add:
//         </div>
//       )}
// Let's find line 745.
const targetLineIdx = lines.findIndex(l => l.includes('          )}') && lines[lines.indexOf(l)+2] && lines[lines.indexOf(l)+2].includes('{/* Delete User Modal */}'));
if (targetLineIdx !== -1) {
  lines.splice(targetLineIdx + 1, 0, '        </div>', '      )}');
}

fs.writeFileSync('components/admin/AdminPanel.tsx', lines.join('\n'));
console.log('Fixed syntax');
