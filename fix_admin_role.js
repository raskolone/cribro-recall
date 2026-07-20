import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  for (const userDoc of snap.docs) {
    const data = userDoc.data();
    if (data.email && data.email.toLowerCase().includes('maciej.wyrozumski')) {
      await updateDoc(doc(db, 'users', userDoc.id), {
        role: 'admin'
      });
      console.log(`Updated user ${data.email} to admin`);
    }
  }
  process.exit(0);
}
run();
