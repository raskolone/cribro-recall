const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-520a4841-33d0-41ef-829a-838ebc44072d' });

async function run() {
  const docRef = db.collection('system').doc('topic_database');
  const snap = await docRef.get();
  if (snap.exists && snap.data().chapters) {
    const chapters = snap.data().chapters;
    const newChapters = chapters.map(chapter => ({
      ...chapter,
      topics: chapter.topics.map(topic => {
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
    await docRef.set({ chapters: newChapters }, { merge: true });
    console.log("Successfully patched topic_database");
  } else {
    console.log("No data found");
  }
}

run().catch(console.error).then(() => process.exit(0));
