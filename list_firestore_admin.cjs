const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
const parsed = JSON.parse(serviceAccountStr);
const adminApp = initializeApp({ credential: cert(parsed) });

const db = getFirestore(adminApp, 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d');

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
