const fs = require('fs');
const path = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

const importRegex = /import \{ getAuth, createUserWithEmailAndPassword \} from 'firebase\/auth';/;
if (content.match(importRegex) && !content.includes("import { createLessonRecordWithVocabularySet")) {
  content = content.replace(importRegex, "import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';\nimport { createLessonRecordWithVocabularySet } from '../../services/lessonRecord';\nimport { countVocabularyItems, buildVocabularySetTitle } from '../../utils/vocabulary';");
} else if (!content.includes("import { createLessonRecordWithVocabularySet")) {
  content = "import { createLessonRecordWithVocabularySet } from '../../services/lessonRecord';\nimport { countVocabularyItems, buildVocabularySetTitle } from '../../utils/vocabulary';\n" + content;
}

const oldSave = `  const handleSaveLessonRecord = async () => {
    if (!lessonFormStudentId) {
      alert("Wybierz kursanta.");
      return;
    }
    setIsSavingLessonRecord(true);
    try {
      const recordData = {
        studentId: lessonFormStudentId,
        date: lessonFormDate,
        topic: lessonFormTopic,
        vocabularyText: lessonFormWords,
        lessonSummary: lessonFormSummary,
        studentSpeaking: lessonFormStudentSpeaking,
        thingsToImprove: lessonFormThingsToImprove,
        suggestedFollowUp: lessonFormSuggestedFollowUp,
        updatedAt: new Date().toISOString()
      };

      if (editingRecordId) {
        await updateDoc(doc(db, \`users/\${lessonFormStudentId}/lessonRecords\`, editingRecordId), recordData);
      } else {
        await addDoc(collection(db, \`users/\${lessonFormStudentId}/lessonRecords\`), {
          ...recordData,
          createdAt: new Date().toISOString()
        });
      }`;

const newSave = `  const handleSaveLessonRecord = async () => {
    if (!lessonFormStudentId) {
      alert("Wybierz kursanta.");
      return;
    }
    setIsSavingLessonRecord(true);
    try {
      if (editingRecordId) {
        const recordData = {
          studentId: lessonFormStudentId,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
          studentSpeaking: lessonFormStudentSpeaking,
          thingsToImprove: lessonFormThingsToImprove,
          suggestedFollowUp: lessonFormSuggestedFollowUp,
          updatedAt: new Date().toISOString()
        };
        
        // Fetch the existing record to see if it has a vocabularySetId
        const recordDoc = await getDocs(query(collection(db, \`users/\${lessonFormStudentId}/lessonRecords\`), where("__name__", "==", editingRecordId)));
        let vocabSetId = "";
        if (!recordDoc.empty) {
           vocabSetId = recordDoc.docs[0].data().vocabularySetId;
        }

        await updateDoc(doc(db, \`users/\${lessonFormStudentId}/lessonRecords\`, editingRecordId), recordData);
        
        if (vocabSetId) {
           await updateDoc(doc(db, \`users/\${lessonFormStudentId}/vocabularySets\`, vocabSetId), {
              date: lessonFormDate,
              topic: lessonFormTopic,
              title: buildVocabularySetTitle(lessonFormDate, lessonFormTopic),
              vocabularyText: lessonFormWords,
              itemCount: countVocabularyItems(lessonFormWords),
              updatedAt: new Date().toISOString()
           });
        }
      } else {
        await createLessonRecordWithVocabularySet({
          studentId: lessonFormStudentId,
          date: lessonFormDate,
          topic: lessonFormTopic,
          vocabularyText: lessonFormWords,
          lessonSummary: lessonFormSummary,
          studentSpeaking: lessonFormStudentSpeaking,
          thingsToImprove: lessonFormThingsToImprove,
          suggestedFollowUp: lessonFormSuggestedFollowUp
        });
        
        // Optionally update the user document to set hasNewVocabulary=true
        await updateDoc(doc(db, 'users', lessonFormStudentId), {
           hasNewVocabulary: true
        });
      }`;

if (content.includes("const handleSaveLessonRecord = async () => {")) {
  content = content.replace(oldSave, newSave);
  fs.writeFileSync(path, content);
  console.log("Patched AdminPanel successfully");
} else {
  console.log("Could not find handleSaveLessonRecord");
}
