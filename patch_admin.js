import fs from 'fs';

// Patch server.ts
let serverContent = fs.readFileSync('server.ts', 'utf-8');
serverContent = serverContent.replace(
  "app.patch('/api/firebase-admin/users/:uid/password'",
  "app.post('/api/firebase-admin/users/:uid/password'"
);
serverContent = serverContent.replace(
  "app.patch('/api/firebase-admin/users/:uid/role'",
  "app.post('/api/firebase-admin/users/:uid/role'"
);
fs.writeFileSync('server.ts', serverContent);

// Patch hooks/useFirebaseAdminApi.ts
let hooksContent = fs.readFileSync('hooks/useFirebaseAdminApi.ts', 'utf-8');
hooksContent = hooksContent.replace(
  "method: 'PATCH',",
  "method: 'POST',"
);
hooksContent = hooksContent.replace(
  "method: 'PATCH',",
  "method: 'POST',"
);
fs.writeFileSync('hooks/useFirebaseAdminApi.ts', hooksContent);
console.log("Patched to POST");
