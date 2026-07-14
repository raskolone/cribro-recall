import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
  const listUsersResult = await getAuth().listUsers(1000);
  console.log(`Found ${listUsersResult.users.length} auth users`);
  
  let added = 0;
  for (const userRecord of listUsersResult.users) {
    if (!userRecord.email) continue;
    
    // Skip if it's an anonymous user that we deleted
    if (userRecord.providerData.length === 0) continue;
    
    const userDocRef = db.collection('users').doc(userRecord.uid);
    const docSnap = await userDocRef.get();
    
    if (!docSnap.exists) {
      console.log(`Restoring missing user in Firestore: ${userRecord.email}`);
      const username = userRecord.displayName || userRecord.email.split('@')[0];
      await userDocRef.set({
        username: username,
        email: userRecord.email,
        role: userRecord.email === 'maciej.wyrozumski@gmail.com' ? 'admin_student' : 'user',
        createdAt: userRecord.metadata.creationTime,
      });
      added++;
    }
  }
  console.log(`Restored ${added} users into Firestore`);
}

run().catch(console.error);
