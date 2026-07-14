const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const target = `          )}
          </div>
        </div>
      )}
      {/* Delete User Modal */}`;

const replacement = `          )}
            </div>
          )}
        </div>
      )}
      {/* Delete User Modal */}`;

code = code.replace(target, replacement);
fs.writeFileSync('components/admin/AdminPanel.tsx', code);
