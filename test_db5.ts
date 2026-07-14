import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountStr) {
  initializeApp({ credential: cert(JSON.parse(serviceAccountStr)) });
} else {
  initializeApp();
}

const db = getFirestore();

async function run() {
  const users = await db.collection('users').get();
  console.log(`Found ${users.size} users`);
  users.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, data.username, data.email, data.role);
  });
}

run().catch(console.error);
