const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
const parsed = JSON.parse(serviceAccountStr);
const adminApp = initializeApp({ credential: cert(parsed) });
const db = getFirestore(adminApp, 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d');

async function run() {
  const q = db.collection('users').doc('z2yaLth5HuWJrbHZWYpyH8ixQgc2').collection('lessonRecords').orderBy('date', 'desc');
  try {
    const snap = await q.get();
    console.log("Success, size:", snap.size);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
