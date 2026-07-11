const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const newFunctions = `  const generateSingleSummary = async (payload: { notes?: string, pdfBase64?: string, driveFile?: { id: string, mimeType: string, token: string } }) => {
    setIsGenerating(true);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : '';

      const allStudents = users.map(u => ({
        id: u.id,
        name: \`\${u.firstName || ''} \${u.lastName || ''}\`.trim() || u.username,
        level: u.level || '',
        description: u.description || '',
        aiPrompt: u.aiPrompt || ''
      }));

      const res = await fetch('/api/gemini/lesson-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({
          ...payload,
          students: allStudents
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        try {
            const errData = JSON.parse(errText);
            throw new Error(errData.error || 'Wystąpił błąd podczas generowania podsumowania');
        } catch(e) {
            throw new Error(\`Błąd serwera (\${res.status}): Otrzymano nieprawidłową odpowiedź.\`);
        }
      }

      const generatedData = await res.json();

      setLessonFormDate(new Date().toISOString().split('T')[0]);
      setLessonFormTopic(generatedData.lessonTopic || 'Lekcja angielskiego');
      
      setLessonFormStudentId(generatedData.studentId || selectedUser?.id || '');
      setLessonFormSummary(generatedData.revisionNotes || '');
      setLessonFormWords(generatedData.vocabularyText || '');
      setLessonFormStudentSpeaking(generatedData.studentSpeaking || '');
      setLessonFormThingsToImprove(generatedData.thingsToImprove || '');
      setLessonFormSuggestedFollowUp(generatedData.suggestedFollowUp || '');

      setShowAIModal(false);
      openLessonRecordModal('edit', undefined, true);
    } catch (err: any) {
      console.error(err);
      alert('Błąd API: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    try {
      const file = e.target.files[0];
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      await generateSingleSummary({ pdfBase64: base64 });
    } catch (err) {
      console.error(err);
      alert('Błąd wgrywania PDF');
    }
  };

  const processDriveFile = async (file: any) => {
    try {
      setShowDriveModal(false);
      setShowAIModal(true);
      const token = await connectGoogleDrive();
      
      await generateSingleSummary({ driveFile: { id: file.id, mimeType: file.mimeType, token } });
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && !err.message?.includes('popup')) {
        console.error(err);
      }
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup')) {
        alert('Aby zalogować się do Google Drive, otwórz aplikację w nowej karcie (przycisk w prawym górnym rogu) lub zezwól na wyskakujące okienka.');
      } else {
        alert('Wystąpił błąd podczas łączenia z dyskiem Google.');
      }
    }
  };

  const handleGenerateFromNotes = async () => {
    if (!rawMeetingNotes.trim()) return;
    await generateSingleSummary({ notes: rawMeetingNotes });
  };`;

// We need to replace the old definitions of handlePdfUpload, processDriveFile, handleGenerateFromNotes.
// Actually, since they are quite large, it's safer to use regex or string replacements, but they might be intertwined.
// Let's first locate them.
