const admin = require('firebase-admin');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
admin.initializeApp({
  projectId: config.projectId,
});

async function run() {
  const token = await admin.auth().createCustomToken('maciej.wyrozumski@gmail.com');
  console.log("Token generated:", token);
  // Wait this is a custom token, we need an ID token.
}
run();
