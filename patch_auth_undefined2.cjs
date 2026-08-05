const fs = require('fs');
let code = fs.readFileSync('context/AuthContext.tsx', 'utf8');

const target1 = `        await updateDoc(userDocRef, { photoURL: result.user.photoURL });`;

const replacement1 = `        if (result.user.photoURL !== undefined) {
          await updateDoc(userDocRef, { photoURL: result.user.photoURL });
        }`;

code = code.replace(target1, replacement1);

fs.writeFileSync('context/AuthContext.tsx', code);
