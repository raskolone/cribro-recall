const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

content = content.replace(/<\/div>\s*<\/nav>/, '</div>\n          </div>\n        </nav>');
fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
