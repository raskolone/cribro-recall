const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf8');

code = code.replace("const usersSnap = await getDocs(collection(db, 'users'));", 
`console.log("Fetching users...");
const usersSnap = await getDocs(collection(db, 'users'));
console.log("Users fetched.");`);

code = code.replace("const idiomsSnap = await getDocs(collection(db, 'global_idioms'));",
`console.log("Fetching idioms...");
const idiomsSnap = await getDocs(collection(db, 'global_idioms'));
console.log("Idioms fetched.");`);

code = code.replace("const phrasalsSnap = await getDocs(collection(db, 'global_phrasals'));",
`console.log("Fetching phrasals...");
const phrasalsSnap = await getDocs(collection(db, 'global_phrasals'));
console.log("Phrasals fetched.");`);

code = code.replace("const setsSnap = await getDocs(collection(db, 'sets'));",
`console.log("Fetching sets...");
const setsSnap = await getDocs(collection(db, 'sets'));
console.log("Sets fetched.");`);

code = code.replace("const lessonsSnap = await getDocs(collection(db, \`users/\${userId}/lessonRecords\`));",
`console.log("Fetching lesson records for user", userId);
const lessonsSnap = await getDocs(collection(db, \`users/\${userId}/lessonRecords\`));
console.log("Lesson records fetched for user", userId);`);

code = code.replace("const docRef = doc(db, 'system', 'topic_database');\n      const snap = await getDoc(docRef);",
`console.log("Fetching topic database...");
const docRef = doc(db, 'system', 'topic_database');
const snap = await getDoc(docRef);
console.log("Topic database fetched.");`);

fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
