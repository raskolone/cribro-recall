const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

code = code.replace(/const fetchDriveFiles = async \(\) => \{\};/g, 'const fetchDriveFiles = async (...args: any[]) => {};');
code = code.replace(/const generateBulkSummary = async \(\) => \{\};/g, 'const generateBulkSummary = async (...args: any[]) => {};');

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
