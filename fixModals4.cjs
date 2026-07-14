const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const target = '{/* Delete User Modal */}';
const insertion = `            </div>
          )}
        </div>
      )}
      `;

code = code.replace(target, insertion + target);
fs.writeFileSync('components/admin/AdminPanel.tsx', code);
