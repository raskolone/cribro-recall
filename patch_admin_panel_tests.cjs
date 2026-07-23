const fs = require('fs');
const file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

// The activeTab rendering: 
// {activeTab === 'tests' && (
//   <AdminTestGenerator user={selectedUser} />
// )}

content = content.replace(
  /\{activeTab === 'tests' && \(\n\s*<AdminTestGenerator user=\{selectedUser\} \/>\n\s*\)\}/,
  `{activeTab === 'tests' && (\n            <AdminTestGenerator user={selectedUser} users={users} />\n          )}`
);

// We need to bypass the generic student list when activeTab is tests and selectedUser is NOT set!
// In the current logic:
// {!selectedUser ? (
//  ... student list ...
// ) : (
//  ... user details + tabs + tab content ...
// )}
//
// Let's change `!selectedUser` to `!selectedUser && activeTab !== 'tests'`

content = content.replace(
  /\{!selectedUser \? \(/,
  "{!selectedUser && activeTab !== 'tests' ? ("
);

// Wait, if activeTab === 'tests' and !selectedUser, it falls into the `else` branch (the user details).
// But we DO NOT want to render the user details/tabs! We only want to render AdminTestGenerator.
fs.writeFileSync(file, content);
