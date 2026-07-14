const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx.bak', 'utf-8');

const lines = code.split('\n');
lines.splice(1140, 3);

const targetLineIdx = lines.findIndex((l, i) => l.includes('          )}') && lines[i+2] && lines[i+2].includes('{/* Delete User Modal */}'));
if (targetLineIdx !== -1) {
  lines.splice(targetLineIdx + 1, 0, '        </div>', '      )}');
}

fs.writeFileSync('components/admin/AdminPanel.tsx', lines.join('\n'));
console.log('Fixed syntax');
