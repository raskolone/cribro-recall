const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "      allow read: if request.auth != null;\n        && (isAdmin() || resource.data.userId == request.auth.uid || resource.data.isPublic == true);",
  "      allow read: if request.auth != null;"
);

fs.writeFileSync('firestore.rules', code);
