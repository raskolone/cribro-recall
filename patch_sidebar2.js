import fs from 'fs';
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf-8');

const targetStr = `  const { language } = useLanguage();`;
const newStr = `  const { language } = useLanguage();
  const isTeacher = user?.role === 'admin' || user?.role === 'admin_student';`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
