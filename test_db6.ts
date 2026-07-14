import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = getApps().length > 0 ? getApps()[0] : initializeApp(config.firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = collection(db, 'users');
  const snapshot = await getDocs(q);
  console.log(`Found ${snapshot.docs.length} users`);
  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    console.log(userDoc.id, data.username, data.email);
    if (data.username && data.username.includes('Demo User')) {
      console.log('Deleting Demo User', userDoc.id);
      await deleteDoc(userDoc.ref);
    }
  }
}
run().catch(console.error);
