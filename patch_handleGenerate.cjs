const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldLogic = `      // Fetch user's recent lesson records for context
      if (user) {
        fetchPromises.push((async () => {
          try {
            const lessonRecordsRef = collection(db, \`users/\${user.id}/lessonRecords\`);
            const qLR = query(lessonRecordsRef, orderBy('date', 'desc'), limit(3));
            const lrSnapshot = await getDocs(qLR);
            const lrList = lrSnapshot.docs.map(doc => doc.data() as LessonRecord);
            
            if (lrList.length > 0) {
              lessonContextString = lrList.map((lr, idx) => {
                let ctx = \`Lesson \${idx + 1} (\${lr.date}): Topic: \${lr.topic}. \`;
                if (lr.lessonSummary) ctx += \`Revision Notes: \${lr.lessonSummary}. \`;
                if (lr.studentSpeaking) ctx += \`Kursant o czym mówił: \${lr.studentSpeaking}. \`;
                if (lr.thingsToImprove) ctx += \`Things to Improve: \${lr.thingsToImprove}. \`;
                if (lr.suggestedFollowUp) ctx += \`Suggested follow-up: \${lr.suggestedFollowUp}. \`;
                if (lr.vocabularyText) ctx += \`Vocabulary & Pronunciation: \${lr.vocabularyText}.\`;
                return ctx;
              }).join('\\n\\n');
            }
          } catch (lrErr) {
            console.warn('Could not fetch lesson records:', lrErr);
          }
        })());`;

const newLogic = `      // Fetch user's recent lesson records for context
      if (user) {
        fetchPromises.push((async () => {
          try {
            const lessonRecordsRef = collection(db, \`users/\${user.id}/lessonRecords\`);
            let lrList: LessonRecord[] = [];
            
            // If user selected specific lessons, load those lessons' context
            if ((selectedSetId === 'lessons' || selectedLessonIds.length > 0) && vocabularySets.length > 0) {
               const selectedSets = vocabularySets.filter(s => selectedLessonIds.includes(s.id));
               const targetRecordIds = selectedSets.map(s => s.lessonRecordId).filter(Boolean);
               if (targetRecordIds.length > 0) {
                  const qLR = query(lessonRecordsRef, where('id', 'in', targetRecordIds.slice(0, 10)));
                  const lrSnapshot = await getDocs(qLR);
                  lrList = lrSnapshot.docs.map(doc => doc.data() as LessonRecord);
               }
            }
            
            // If no specific lessons picked or found, fallback to latest 3
            if (lrList.length === 0) {
               const qLR = query(lessonRecordsRef, orderBy('date', 'desc'), limit(3));
               const lrSnapshot = await getDocs(qLR);
               lrList = lrSnapshot.docs.map(doc => doc.data() as LessonRecord);
            }
            
            if (lrList.length > 0) {
              lessonContextString = lrList.map((lr, idx) => {
                let ctx = \`Lesson \${idx + 1} (\${lr.date}): Topic: \${lr.topic}. \`;
                if (lr.lessonSummary) ctx += \`Revision Notes: \${lr.lessonSummary}. \`;
                if (lr.studentSpeaking) ctx += \`Kursant o czym mówił: \${lr.studentSpeaking}. \`;
                if (lr.thingsToImprove) ctx += \`Things to Improve: \${lr.thingsToImprove}. \`;
                if (lr.suggestedFollowUp) ctx += \`Suggested follow-up: \${lr.suggestedFollowUp}. \`;
                if (lr.vocabularyText) ctx += \`Vocabulary & Pronunciation: \${lr.vocabularyText}.\`;
                return ctx;
              }).join('\\n\\n');
            }
          } catch (lrErr) {
            console.warn('Could not fetch lesson records:', lrErr);
          }
        })());`;

if (content.includes(oldLogic)) {
  content = content.replace(oldLogic, newLogic);
  fs.writeFileSync(path, content);
  console.log("Patched lesson context logic successfully");
} else {
  console.log("oldLogic not found");
}
