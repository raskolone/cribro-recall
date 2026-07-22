const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const target = `const handleSaveBulkLessons = async () => {};`;

const replacement = `const handleSaveBulkLessons = async () => {
    setIsGenerating(true);
    try {
      let savedCount = 0;
      for (const lesson of bulkPreviewLessons) {
        if (!lesson.studentId) continue;
        await createLessonRecordWithVocabularySet({
          studentId: lesson.studentId,
          date: lesson.date || new Date().toISOString().split('T')[0],
          topic: lesson.lessonTopic || 'Podsumowanie lekcji',
          vocabularyText: lesson.vocabularyText || '',
          lessonSummary: lesson.revisionNotes || '',
          studentSpeaking: lesson.studentSpeaking || '',
          thingsToImprove: lesson.thingsToImprove || '',
          suggestedFollowUp: lesson.suggestedFollowUp || ''
        });
        
        await updateDoc(doc(db, 'users', lesson.studentId), {
           hasNewVocabulary: true
        });
        savedCount++;
      }
      
      alert(\`Zapisano \${savedCount} wpisów z lekcji.\`);
      setShowBulkPreviewModal(false);
      setBulkPreviewLessons([]);
      
      if (selectedUser) {
        fetchUserLogsAndStats(selectedUser.id);
      }
    } catch (e) {
      alert('Błąd podczas zapisywania lekcji: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('components/admin/AdminPanel.tsx', code);
  console.log('patched');
} else {
  console.log('target not found');
}
