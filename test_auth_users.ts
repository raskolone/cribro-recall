import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountStr) {
  initializeApp({ credential: cert(JSON.parse(serviceAccountStr)) });
} else {
  initializeApp();
}

async function run() {
  const listUsersResult = await getAuth().listUsers(1000);
  console.log(`Found ${listUsersResult.users.length} auth users`);
  listUsersResult.users.forEach((userRecord) => {
    console.log(userRecord.uid, userRecord.email, userRecord.displayName);
  });
}
run().catch(console.error);
