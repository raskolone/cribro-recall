const fs = require('fs');
const path = 'services/lessonRecord.ts';
let content = fs.readFileSync(path, 'utf8');

const oldGetVocab = `export async function getVocabularySetsForStudent(studentId: string): Promise<VocabularySet[]> {
  const setsRef = collection(db, \`users/\${studentId}/vocabularySets\`);
  const q = query(setsRef, orderBy('date', 'desc'));
  
  const snapshot = await getDocs(q);
  const sets: VocabularySet[] = [];
  
  snapshot.forEach((doc) => {
    sets.push({ id: doc.id, ...doc.data() } as VocabularySet);
  });
  
  return sets;
}`;

const newGetVocab = `export async function getVocabularySetsForStudent(studentId: string): Promise<VocabularySet[]> {
  const setsRef = collection(db, \`users/\${studentId}/vocabularySets\`);
  const q = query(setsRef, orderBy('date', 'desc'));
  
  const snapshot = await getDocs(q);
  let sets: VocabularySet[] = [];
  
  snapshot.forEach((doc) => {
    sets.push({ id: doc.id, ...doc.data() } as VocabularySet);
  });
  
  // Backward compatibility: fetch old lessonRecords that don't have a corresponding vocabularySet
  const recordsRef = collection(db, \`users/\${studentId}/lessonRecords\`);
  const qRecords = query(recordsRef, orderBy('date', 'desc'));
  const recordsSnapshot = await getDocs(qRecords);
  
  recordsSnapshot.forEach((docSnap) => {
    const record = { id: docSnap.id, ...docSnap.data() } as LessonRecord;
    // Check if this record has vocabulary but doesn't have a corresponding vocabulary set
    if (record.vocabularyText && record.vocabularyText.trim().length > 0) {
       const alreadyExists = sets.some(s => s.lessonRecordId === record.id || s.date === record.date && s.topic === record.topic);
       if (!alreadyExists) {
          sets.push({
            id: \`generated-\${record.id}\`,
            studentId: record.studentId,
            lessonRecordId: record.id,
            title: buildVocabularySetTitle(record.date, record.topic),
            date: record.date,
            topic: record.topic,
            vocabularyText: record.vocabularyText,
            itemCount: countVocabularyItems(record.vocabularyText),
            status: 'ready',
            source: 'lesson_record',
            createdAt: record.createdAt || record.date,
            updatedAt: record.updatedAt || record.date
          });
       }
    }
  });
  
  // Sort by date descending again after merging
  sets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return sets;
}`;

if (content.includes("export async function getVocabularySetsForStudent")) {
  content = content.replace(oldGetVocab, newGetVocab);
  fs.writeFileSync(path, content);
  console.log("Patched getVocabularySetsForStudent successfully");
} else {
  console.log("oldGetVocab not found");
}
