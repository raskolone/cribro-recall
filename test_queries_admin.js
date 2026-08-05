import { initializeApp as adminInit, applicationDefault } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import fs from "fs";

// Init admin
const adminApp = adminInit({ credential: applicationDefault() });

// Init client
const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  try {
    const customToken = await adminAuth(adminApp).createCustomToken("test-uid-123", { email: "maciej.wyrozumski@gmail.com" });
    await signInWithCustomToken(auth, customToken);
    console.log("Signed in.");
  } catch (e) {
    console.log("Sign in failed:", e.message);
    process.exit(1);
  }

  // Create user doc if not exists using admin to avoid rules
  const adminDb = (await import("firebase-admin/firestore")).getFirestore(adminApp);
  await adminDb.collection("users").doc("test-uid-123").set({
    id: "test-uid-123",
    username: "Test",
    email: "maciej.wyrozumski@gmail.com",
    role: "admin"
  });
  console.log("Admin user doc created.");

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

  try {
    console.log("Fetching lessons...");
    await getDocs(collection(db, "users/some-other-id/lessonRecords"));
    console.log("Lessons fetched.");
  } catch (e) {
    console.log("Lessons failed:", e.message);
  }

  process.exit(0);
}

run();
