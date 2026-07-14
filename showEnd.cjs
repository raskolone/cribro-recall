const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
const start = code.indexOf("{activeTab === 'stats' && (");
const end = code.indexOf("{/* Delete User Modal */}");
const rest = code.slice(start, end);
console.log(rest.slice(-200));
