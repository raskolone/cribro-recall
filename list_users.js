import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';

const serviceAccount = JSON.parse(await readFile('./.firebase/serviceAccountKey.json', 'utf8').catch(() => '{}'));
// since we are using firebase-admin/app but there is a way to use the existing server.ts
