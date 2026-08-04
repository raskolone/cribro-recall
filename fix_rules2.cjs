const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(/request\.isAdmin\(\) \|\| resource\.data\.studentId == request\.auth\.uid/g, "isAdmin() || request.resource.data.studentId == request.auth.uid");

fs.writeFileSync('firestore.rules', code);
