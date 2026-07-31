const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

if (!code.includes("AdminMessageModal")) {
  code = code.replace(
    "import BugReporter from '../ui/BugReporter';",
    "import BugReporter from '../ui/BugReporter';\nimport AdminMessageModal from '../ui/AdminMessageModal';"
  );
  
  // Render it before </AnimatePresence> or right before the closing </div> of Dashboard
  code = code.replace(
    "<BugReporter />",
    "<BugReporter />\n      <AdminMessageModal />"
  );
  
  fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
}
