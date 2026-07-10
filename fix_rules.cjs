const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf-8');

const target = `    function isAdmin() {
      return isAuthenticated() &&
        (('email' in request.auth.token && request.auth.token.email == "maciej.wyrozumski@gmail.com") ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'admin_student']));
    }`;

const replacement = `    function isAdmin() {
      return isAuthenticated() &&
        (
          ('email' in request.auth.token && request.auth.token.email == "maciej.wyrozumski@gmail.com") ||
          (
            exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'admin_student']
          )
        );
    }`;

code = code.replace(target, replacement);

const target2 = `      allow create: if (isOwner(userId) || isAdmin()) && isValidUser(request.resource.data) && ((request.resource.data.role == 'user') || isAdmin());`;
const replacement2 = `      allow create: if (isOwner(userId) || isAdmin()) && isValidUser(request.resource.data) && ((request.resource.data.role == 'user') || ('email' in request.auth.token && request.auth.token.email == "maciej.wyrozumski@gmail.com") || isAdmin());`;
code = code.replace(target2, replacement2);

fs.writeFileSync('firestore.rules', code);
