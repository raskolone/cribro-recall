const fs = require('fs');
const file = 'components/dashboard/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `return <AdminPanel initialTab={view === 'admin' ? null : view.replace('admin-', '')} onViewChange={setView} />;`;
const replacement = `return <AdminPanel initialTab={view === 'admin' ? null : view.replace('admin-', '')} onViewChange={setView} initialSelectedUserId={adminSelectedUserId} />;`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(file, code);
    console.log("Updated AdminPanel prop");
} else {
    console.log("Could not find target in Dashboard.tsx");
}
