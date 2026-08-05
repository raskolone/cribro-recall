import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  try {
    await signInWithEmailAndPassword(auth, "maciej.wyrozumski@gmail.com", "dummy_password_if_known");
    console.log("Signed in.");
  } catch (e) {
    console.log("Could not sign in:", e.message);
    // Let's try signing in with demo user
    try {
      await signInWithEmailAndPassword(auth, "demo@vocabboost.com", "demo123456");
      console.log("Signed in as demo.");
    } catch (e2) {
      console.log("Demo sign in failed:", e2.message);
      process.exit(1);
    }
  }

  try {
    console.log("Fetching users...");
    await getDocs(collection(db, "users"));
    console.log("Users fetched.");
  } catch (e) {
    console.log("Users failed:", e.message);
  }

  try {
    console.log("Fetching topic_database...");
    await getDoc(doc(db, "system", "topic_database"));
    console.log("Topic database fetched.");
  } catch (e) {
    console.log("Topic database failed:", e.message);
  }

  process.exit(0);
}

run();
