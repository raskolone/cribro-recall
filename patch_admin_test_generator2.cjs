const fs = require('fs');
const file = 'components/admin/AdminTestGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/  \);\n\};\n  \)\}\n    <\/div>\n  \);\n\};\nexport default AdminTestGenerator;/, `  )\}\n    <\/div>\n  );\n};\nexport default AdminTestGenerator;`);
fs.writeFileSync(file, content);
