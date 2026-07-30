const fs = require('fs');
let code = fs.readFileSync('context/AuthContext.tsx', 'utf-8');

const target = `            if (firebaseUser.email && firebaseUser.email.toLowerCase().includes('maciej.wyrozumski') && data.role !== 'admin') {`;
const replacement = `            if (data.isSuspended) {
              alert("Twoje konto zostało zawieszone.");
              await auth.signOut();
              setUser(null);
              setIsAuthReady(true);
              return;
            }
            if (firebaseUser.email && firebaseUser.email.toLowerCase().includes('maciej.wyrozumski') && data.role !== 'admin') {`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('context/AuthContext.tsx', code);
    console.log("Patched AuthContext.tsx");
} else {
    console.log("Target not found");
}
