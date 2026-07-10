import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
    try {
        await signInWithEmailAndPassword(auth, "maciej.wyrozumski@gmail.com", "password123");
        console.log("Logged in");
        const docRef = doc(db, 'users', auth.currentUser!.uid);
        const snapshot = await getDoc(docRef);
        console.log("Doc exists:", snapshot.exists());
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
