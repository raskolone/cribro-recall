const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

code = code.replace(
  "    </div>\n  );\n};\n\nexport default Dashboard;",
  "      <AdminMessageModal />\n    </div>\n  );\n};\n\nexport default Dashboard;"
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
