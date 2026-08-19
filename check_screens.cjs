const fs = require('fs');

const dashboard = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');
console.log('Dashboard main tag:');
console.log(dashboard.match(/<main[^>]*>/g));

const adminPanel = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');
console.log('AdminPanel root:');
console.log(adminPanel.match(/return \(\s*<div[^>]*>/g));
