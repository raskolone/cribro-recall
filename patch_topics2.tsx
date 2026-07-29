import * as fs from 'fs';

let envStr = '';
try {
  envStr = fs.readFileSync('.env', 'utf8');
} catch (e) {}

const env: Record<string, string> = {};
envStr.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    env[key.trim()] = rest.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
  }
});

(global as any).import = {
  meta: {
    env: {
      ...env,
      VITE_FIREBASE_CONFIG: process.env.VITE_FIREBASE_CONFIG || env.VITE_FIREBASE_CONFIG,
    }
  }
};

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

async function patch() {
  const docRef = doc(db, 'system', 'topic_database');
  const snap = await getDoc(docRef);
  if (snap.exists() && snap.data().chapters) {
    const chapters = snap.data().chapters;
    const newChapters = chapters.map((chapter: any) => ({
      ...chapter,
      topics: chapter.topics.map((topic: any) => {
        let name = topic.name;
        if (name.includes(' — ')) {
          name = name.split(' — ')[0].trim();
        }
        return {
          ...topic,
          name: name,
          sentences: `Wykorzystaj przykłady zdań z danego rozdziału np. ${name} i wygeneruj podobne zdania na tym samym poziomie`
        };
      })
    }));
    await setDoc(docRef, { chapters: newChapters }, { merge: true });
    console.log('Successfully patched topic_database');
  } else {
    console.log('No chapters found');
  }
}

patch().catch(console.error).then(() => process.exit(0));
