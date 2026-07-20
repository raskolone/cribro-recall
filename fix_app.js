import fs from 'fs';

let file = 'App.tsx';
let content = fs.readFileSync(file, 'utf-8');

// The view switching logic might be in two places. Let's find it.
content = content.replace(
  /user\.requirePasswordChange \? 'force-password-change' : 'dashboard'/g,
  "(user.requirePasswordChange && (user.tempPasswordLogins || 0) >= 3) ? 'force-password-change' : 'dashboard'"
);

content = content.replace(
  /user\.requirePasswordChange \?/g,
  "(user.requirePasswordChange && (user.tempPasswordLogins || 0) >= 3) ?"
);

fs.writeFileSync(file, content);
console.log("Updated App.tsx");
