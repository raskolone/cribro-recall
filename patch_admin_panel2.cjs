const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

code = code.replace(
  /<TeacherDashboardActivity users=\{users\} \/>/g,
  ""
);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
