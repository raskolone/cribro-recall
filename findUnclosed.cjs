const fs = require('fs');
const lines = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8').split('\n');

let balanceParen = 0;
let balanceBrace = 0;
let balanceTag = 0;
// We can't really do this simply because of JSX.
