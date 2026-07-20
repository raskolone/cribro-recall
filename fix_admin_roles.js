import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

// 1. Replace admin_student with teacher
content = content.replace(/'admin_student'/g, "'teacher'");
content = content.replace(/admin_student/g, "teacher");

// 2. Change "Admin + Kursant" label to "Nauczyciel"
content = content.replace(/Admin \+ Kursant/g, "Nauczyciel");

// 3. Make sure handleRoleChange signature matches new types
content = content.replace(
  /const handleRoleChange = async \(newRole: 'admin' \| 'user' \| 'teacher'\) => \{/,
  "const handleRoleChange = async (newRole: 'admin' | 'user' | 'teacher') => {"
);

// 4. Hide "Ustawienia konta" for non-admins
// Currently it's `<div className="mt-8 pt-6 border-t border-white/10">`
// Let's find the current user from useAuth
const authMatch = "const { createUser, deleteUser, changeUserRole: updateRoleApi, changeUserPassword } = useFirebaseAdminApi();";
const authReplacement = "const { createUser, deleteUser, changeUserRole: updateRoleApi, changeUserPassword } = useFirebaseAdminApi();\n  const { user: currentUser } = useAuth();";
if (!content.includes("user: currentUser")) {
  content = content.replace(authMatch, authReplacement);
}

// 5. Wrap settings in currentUser?.role === 'admin'
content = content.replace(
  /<div className="mt-8 pt-6 border-t border-white\/10">\n\s*<h3 className="text-lg font-bold mb-4">Ustawienia konta<\/h3>/,
  "{currentUser?.role === 'admin' && (\n<div className=\"mt-8 pt-6 border-t border-white/10\">\n                  <h3 className=\"text-lg font-bold mb-4\">Ustawienia konta</h3>"
);

// We need to close the `currentUser?.role === 'admin' && (` block. Let's see the structure.
fs.writeFileSync(file, content);
console.log("Updated roles in AdminPanel");
