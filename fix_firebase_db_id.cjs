const fs = require('fs');
let code = fs.readFileSync('firebase.ts', 'utf-8');

const target = `export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId || (defaultFirebaseConfig as any).firestoreDatabaseId);`;
const replacement = `export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, "ai-studio-520a4841-33d0-41ef-829a-838ebc44072d");`;

code = code.replace(target, replacement);
fs.writeFileSync('firebase.ts', code);
