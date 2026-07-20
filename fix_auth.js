import fs from 'fs';

let file = 'context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /loginCount: \(userData\.loginCount \|\| 0\) \+ 1,\n          lastLoginDate: new Date\(\)\.toISOString\(\)/,
  "loginCount: (userData.loginCount || 0) + 1,\n          lastLoginDate: new Date().toISOString(),\n          ...(userData.requirePasswordChange ? { tempPasswordLogins: (userData.tempPasswordLogins || 0) + 1 } : {})"
);

fs.writeFileSync(file, content);
console.log("Updated AuthContext.tsx");
