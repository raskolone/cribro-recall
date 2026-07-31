const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const targetImport = "const StudentTestsScreen = React.lazy(() => import('../tests/StudentTestsScreen'));";
const newImport = "const StudentTestsScreen = React.lazy(() => import('../tests/StudentTestsScreen'));\nconst AdminStatsScreen = React.lazy(() => import('../admin/AdminStatsScreen'));";
code = code.replace(targetImport, newImport);

const targetRender = `    if (view === 'student-stats') {
        return <React.Suspense fallback={<div>Loading...</div>}><StudentStatsScreen /></React.Suspense>;
    }`;
const newRender = `    if (view === 'student-stats') {
        return <React.Suspense fallback={<div>Loading...</div>}><StudentStatsScreen /></React.Suspense>;
    }
    if (view === 'admin-stats') {
        return <React.Suspense fallback={<div>Loading...</div>}><AdminStatsScreen /></React.Suspense>;
    }`;
code = code.replace(targetRender, newRender);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
