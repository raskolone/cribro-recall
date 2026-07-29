const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

code = code.replace(
  /const \{ user \} = useAuth\(\);/,
  "const { user } = useAuth();\n  const isTeacherGlobal = user?.role === 'admin' || user?.role === 'teacher';"
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
