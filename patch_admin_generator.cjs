const fs = require('fs');
const path = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldBlock = `  const fetchDriveFiles = async (mode?: string) => {};
  const handlePdfUpload = async (e: any, mode?: string) => {};
  const handleGenerateFromNotes = async () => {};
  const generateBulkSummary = async (logs: any) => {};`;

const newBlock = `  const fetchDriveFiles = async (mode?: string) => {
    alert('Integracja z Google Drive wymaga skonfigurowania OAuth. Możesz użyć opcji przesłania pliku PDF poniżej.');
  };

  const mapStudents = () => users.map(u => ({ id: u.id, name: \`\${u.firstName || ''} \${u.lastName || ''}\`.trim() || u.username, level: u.level, description: u.description }));

  const applySingleSummary = (data: any) => {
    if (data.studentId) setLessonFormStudentId(data.studentId);
    if (data.lessonTopic) setLessonFormTopic(data.lessonTopic);
    if (data.revisionNotes) setLessonFormNotes(data.revisionNotes);
    if (data.vocabularyText) setLessonFormVocabulary(data.vocabularyText);
    if (data.studentSpeaking) setLessonFormStudentSpeaking(data.studentSpeaking);
    if (data.thingsToImprove) setLessonFormThingsToImprove(data.thingsToImprove);
    if (data.suggestedFollowUp) setLessonFormSuggestedFollowUp(data.suggestedFollowUp);
    
    setLessonFormDate(new Date().toISOString().split('T')[0]);
    setShowAIModal(false);
    setRawMeetingNotes('');
    setFormMode('create');
    setShowLessonForm(true);
  };

  const handlePdfUpload = async (e: any, mode?: string) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result?.toString().split(',')[1];
      if (!base64) return;
      
      if (mode === 'single') {
        setIsGenerating(true);
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/gemini/lesson-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
            body: JSON.stringify({
              pdfBase64: base64,
              students: mapStudents()
            })
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          applySingleSummary(data);
        } catch(err: any) {
          alert("Error: " + err.message);
        } finally {
          setIsGenerating(false);
          e.target.value = '';
        }
      } else {
        generateBulkSummary({ pdfBase64: base64 });
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateFromNotes = async () => {
    if (!rawMeetingNotes.trim()) return;
    setIsGenerating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const res = await fetch('/api/gemini/lesson-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({
          notes: rawMeetingNotes,
          students: mapStudents()
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applySingleSummary(data);
    } catch (err: any) {
      alert("Error generating summary: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBulkSummary = async ({ notes, pdfBase64, driveFile }: any) => {
    setIsGenerating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const res = await fetch('/api/gemini/import-lessons-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({
          textContent: notes,
          pdfBase64,
          driveFile,
          students: mapStudents()
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      if (data.lessons && Array.isArray(data.lessons)) {
        setBulkPreviewLessons(data.lessons);
        setShowBulkPreviewModal(true);
        setShowBulkModal(false);
        setBulkNotes('');
      } else {
        alert("Unexpected response format");
      }
    } catch (err: any) {
      alert("Error generating bulk summary: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync(path, content);
console.log("Patched AdminPanel generator");
