const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

// The bottom of the file is:
// </button>
// </div>
// </div>
// </nav>
// </aside>
//
// We want to delete the two </div> lines.

content = content.replace(/<\/button>\s*<\/div>\s*<\/div>\s*<\/nav>/, '</button>\n        </nav>');
fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
