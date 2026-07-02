import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const getAdminApp = () => {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d'
  });
};

async function check() {
  const db = getFirestore(getAdminApp());
  const snap = await db.collection('users').doc('LhO4BkVwMgazfywBoCfwlt5UjBN2').get();
  console.log(snap.data());
  process.exit(0);
}
check().catch(console.error);
