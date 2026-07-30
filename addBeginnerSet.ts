// Mock import.meta.env
(global as any).import = { meta: { env: {} } };

async function run() {
  const { db } = await import('./firebase');
  const { doc, writeBatch } = await import('firebase/firestore');

  const beginnerWords = [
    "apple", "banana", "book", "car", "cat", "chair", "child", "city", "class", "clock",
    "coffee", "computer", "day", "dog", "door", "drink", "eat", "egg", "family", "father",
    "fish", "food", "friend", "game", "girl", "go", "good", "happy", "hello", "house",
    "job", "key", "kitchen", "know", "light", "love", "man", "money", "morning", "mother",
    "name", "night", "open", "people", "play", "school", "see", "speak", "table", "time",
    "water", "work", "world", "write", "yes"
  ];

  const setId = `set-beginner-${Date.now()}`;
  const setDocRef = doc(db, 'sets', setId);
  
  const setData = {
    id: setId,
    title: 'Podstawy Angielskiego',
    description: 'Zestaw dla początkujących. Prompt dla AI: Generuj podstawowe zwroty w języku angielskim, takie jak pytanie o pracę, o drogę i tak dalej.',
    aiPrompt: 'Generuj podstawowe zwroty w języku angielskim, takie jak pytanie o pracę, o drogę i tak dalej.',
    cardCount: beginnerWords.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: true
  };

  const batch = writeBatch(db);
  batch.set(setDocRef, setData);

  beginnerWords.forEach((word, idx) => {
    const cardId = `card-${setId}-${idx}`;
    const cardRef = doc(db, `sets/${setId}/flashcards`, cardId);
    batch.set(cardRef, {
      id: cardId,
      setId: setId,
      english: word,
      polish: '', // Could look up or leave empty as it's a "list of words"
      createdAt: new Date().toISOString()
    });
  });

  await batch.commit();
  console.log('Set added:', setId);
}

run();
