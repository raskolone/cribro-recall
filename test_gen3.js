import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app);

// Mock browser env
global.window = {};

import { generateTranslationExercises } from './services/geminiService.ts';

async function run() {
  try {
    const res = await generateTranslationExercises("B2", ["house", "cat"], "Translate these.", "lesson context", "student profile", 2, "past exercises");
    console.log("SUCCESS:", res);
  } catch(e) {
    console.error("FAIL:", e);
  }
}
run();
