import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountStr) {
  initializeApp({ credential: cert(JSON.parse(serviceAccountStr)), projectId: config.projectId });
} else {
  initializeApp({ projectId: config.projectId });
}

const db = getFirestore(config.firestoreDatabaseId);

async function run() {
  const users = await db.collection('users').get();
  console.log(`Found ${users.size} users`);
  let deleted = 0;
  for (const doc of users.docs) {
    const data = doc.data();
    console.log(doc.id, data.username, data.email, data.role);
    if ((data.username && data.username.includes('Demo')) || (!data.email && !data.role)) {
       console.log('Deleting Demo/Invalid:', doc.id);
       await doc.ref.delete();
       deleted++;
    }
  }
  console.log('Deleted', deleted);
}

run().catch(console.error);
