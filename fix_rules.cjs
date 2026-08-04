const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(/resource\.data\.studentId == request\.auth\.uid \|\| isAdmin\(\)/g, "isAdmin() || resource.data.studentId == request.auth.uid");
code = code.replace(/request\.resource\.data\.studentId == request\.auth\.uid \|\| isAdmin\(\)/g, "isAdmin() || request.resource.data.studentId == request.auth.uid");
code = code.replace(/resource\.data\.userId == request\.auth\.uid \|\| resource\.data\.isPublic == true \|\| isAdmin\(\)/g, "isAdmin() || resource.data.userId == request.auth.uid || resource.data.isPublic == true");
code = code.replace(/request\.resource\.data\.userId == request\.auth\.uid \|\| isAdmin\(\)/g, "isAdmin() || request.resource.data.userId == request.auth.uid");
code = code.replace(/resource\.data\.userId == request\.auth\.uid \|\| isAdmin\(\)/g, "isAdmin() || resource.data.userId == request.auth.uid");

fs.writeFileSync('firestore.rules', code);
