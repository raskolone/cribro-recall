const fs = require('fs');
let code = fs.readFileSync('context/AuthContext.tsx', 'utf8');

code = code.replace(
  "updateUserStreak, connectGoogleDrive }>",
  "updateUserStreak, connectGoogleDrive, linkGoogleAccount }>"
);

fs.writeFileSync('context/AuthContext.tsx', code);
