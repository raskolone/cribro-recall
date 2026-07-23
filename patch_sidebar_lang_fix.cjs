const fs = require('fs');

let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

content = content.replace('const { language } = useLanguage();', 'const { language, setLanguage } = useLanguage();');

fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
