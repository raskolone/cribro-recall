import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

let adminApp;
try {
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  const parsed = JSON.parse(serviceAccountStr);
  adminApp = initializeApp({ credential: cert(parsed) });
} catch (e) {
  console.log("no service account");
  process.exit(1);
}

const db = getFirestore(adminApp);

async function run() {
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    console.log(`User: ${data.email} (${userDoc.id})`);
    
    const lessonsSnap = await userDoc.ref.collection('lessonRecords').get();
    console.log(`  Lessons count: ${lessonsSnap.size}`);
    lessonsSnap.forEach(doc => {
      console.log(`    Lesson: ${doc.id} - ${doc.data().topic} - ${doc.data().date}`);
    });
  }
}
run();
