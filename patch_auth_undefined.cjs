const fs = require('fs');
let code = fs.readFileSync('context/AuthContext.tsx', 'utf8');

const target1 = `              const newUser: User = {
                id: firebaseUser.uid,
                username: defaultName,
                email: email,
                role: role,
                photoURL: firebaseUser.photoURL || undefined
              };`;

const replacement1 = `              const newUser: any = {
                id: firebaseUser.uid,
                username: defaultName,
                email: email,
                role: role
              };
              if (firebaseUser.photoURL) newUser.photoURL = firebaseUser.photoURL;`;

code = code.replace(target1, replacement1);

const target2 = `          setUser({
            id: firebaseUser.uid,
            username: firebaseUser.displayName || (fallbackEmail ? fallbackEmail.split('@')[0] : 'User'),
            email: fallbackEmail,
            photoURL: firebaseUser.photoURL || undefined,
            role: fallbackEmail === 'maciej.wyrozumski@gmail.com' ? 'admin' : 'user'
          });`;

const replacement2 = `          const u: any = {
            id: firebaseUser.uid,
            username: firebaseUser.displayName || (fallbackEmail ? fallbackEmail.split('@')[0] : 'User'),
            email: fallbackEmail,
            role: fallbackEmail === 'maciej.wyrozumski@gmail.com' ? 'admin' : 'user'
          };
          if (firebaseUser.photoURL) u.photoURL = firebaseUser.photoURL;
          setUser(u as User);`;

code = code.replace(target2, replacement2);

fs.writeFileSync('context/AuthContext.tsx', code);
