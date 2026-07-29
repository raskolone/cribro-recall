const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

// The main component starts as export default function Dashboard({ initialView = 'dashboard', initialSelectedSetId = null, initialPracticeView = null }: DashboardProps) {
// Let's just define const isTeacherGlobal = user?.role === 'admin' || user?.role === 'teacher'; near the top of the component and replace !isTeacher with !isTeacherGlobal in my changes.

code = code.replace(
  /const \{ user, logout \} = useAuth\(\);/,
  "const { user, logout } = useAuth();\n  const isTeacherGlobal = user?.role === 'admin' || user?.role === 'teacher';"
);

code = code.replace(
  /\(!isTeacher && view === 'dashboard'\)/g,
  "(!isTeacherGlobal && view === 'dashboard')"
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
