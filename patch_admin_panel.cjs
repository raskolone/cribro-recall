const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

code = code.replace(
  "{/* Single Glass Box: Ogólne statystyki kursantów */}\\n          <TeacherDashboardActivity users={users} />",
  ""
);

code = code.replace(
  "import TeacherDashboardActivity from './TeacherDashboardActivity';",
  ""
);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
