const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const badString = '          </div>\n        </div>\n      )}\n{/* Change Password Modal */}';
code = code.replace(badString, '{/* Change Password Modal */}');

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
