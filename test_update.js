import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = require('./firebase-applet-config.json');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  try {
    await signInWithEmailAndPassword(auth, 'maciej.wyrozumski@gmail.com', 'haslo123'); // or whatever test credentials
    const uid = auth.currentUser.uid;
    console.log("Logged in:", uid);
    await updateDoc(doc(db, 'users', uid), { hasNewLesson: false });
    console.log("Update success!");
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
