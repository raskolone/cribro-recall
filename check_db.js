import { initializeApp as adminInit, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const adminApp = adminInit({ credential: applicationDefault() });
const db = getFirestore(adminApp);

async function run() {
  const users = await db.collection("users").get();
  console.log("Users in DB:");
  users.forEach(u => console.log(u.id, u.data().email, u.data().role));
}

run().catch(console.error);
