import { initializeApp, cert } from "firebase-admin/app";
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

const emailsToDelete = [
  "kasia.skrzypiec27@gmail.com",
  "helloworld@maciej.pro",
  "wyrozumski@maciej.pro",
  "agnieszkawyrozumska01@gmail.com",
  "bartekbbbb@student.vocabboost.com",
  "agnieszkawyrozumska3@gmail.com",
  "bartekbarto@student.vocabboost.com",
  "uczen1@student.vocabboost.com",
  "bartek02912@student.vocabboost.com",
  "ewa9304@wp.pl"
];

async function run() {
  const users = await db.collection('users').get();
  console.log(`Found ${users.size} users`);
  let deleted = 0;
  for (const doc of users.docs) {
    const data = doc.data();
    if (data.email && emailsToDelete.includes(data.email)) {
       console.log('Deleting synced user:', data.email);
       await doc.ref.delete();
       deleted++;
    }
  }
  console.log('Deleted', deleted);
}

run().catch(console.error);
