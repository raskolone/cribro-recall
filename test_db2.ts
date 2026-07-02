import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const getAdminApp = () => {
  if (getApps().length > 0) {
    return getApp();
  }
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
  }
  return initializeApp({ credential });
};

async function check() {
  const db = getFirestore(getAdminApp());
  const snap = await db.collection('users').doc('LhO4BkVwMgazfywBoCfwlt5UjBN2').get();
  console.log(snap.data());
  process.exit(0);
}
check().catch(console.error);
