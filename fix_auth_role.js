import fs from 'fs';
let file = 'context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /if \(userDoc\.exists\(\)\) \{\s*setUser\(\{ id: firebaseUser\.uid, \.\.\.userDoc\.data\(\) \} as User\);\s*\}/,
  `if (userDoc.exists()) {
            let data = userDoc.data();
            if (firebaseUser.email && firebaseUser.email.toLowerCase().includes('maciej.wyrozumski') && data.role !== 'admin') {
              data.role = 'admin';
              try {
                await updateDoc(userDocRef, { role: 'admin' });
              } catch(e) {}
            }
            setUser({ id: firebaseUser.uid, ...data } as User);
          }`
);

fs.writeFileSync(file, content);
console.log("Fixed role assignment for Maciej");
