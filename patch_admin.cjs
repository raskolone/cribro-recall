const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const regex = /const processDriveFile = async[\s\S]*?const handleSaveLessonRecord = async/m;

const newCode = `  const generateSingleSummary = async (payload: { notes?: string, pdfBase64?: string, driveFile?: { id: string, mimeType: string, token: string } }) => {
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

  const handleBatchImport = async (textContent: string, pdfBase64: string, driveFile?: { id: string, mimeType: string, token: string }) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/gemini/import-lessons-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({
          textContent,
          pdfBase64,
          driveFile,
          students: users.map(u => ({ id: u.id, name: u.firstName || u.username, level: u.level, description: u.description }))
        })
      });

      let result;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('Server returned non-JSON:', text);
        if (response.status === 413) {
           throw new Error('Plik jest zbyt duży (przekroczono limit).');
        } else if (response.status === 504) {
           throw new Error('Przekroczono czas oczekiwania na odpowiedź od AI (Gateway Timeout).');
        } else {
           throw new Error(\`Błąd serwera (\${response.status}): Otrzymano nieprawidłową odpowiedź.\`);
        }
      }

      if (!response.ok) throw new Error(result.error || 'Nieznany błąd API');

      if (result.lessons && result.lessons.length > 0) {
         let importedCount = 0;
         for (const lesson of result.lessons) {
           if (lesson.studentId) {
             const newRecord = {
               id: crypto.randomUUID(),
               studentId: lesson.studentId,
               date: lesson.date || new Date().toISOString().split('T')[0],
               topic: lesson.lessonTopic,
               lessonSummary: lesson.revisionNotes,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString(),
               vocabularyText: lesson.vocabularyText,
               studentSpeaking: lesson.studentSpeaking,
               thingsToImprove: lesson.thingsToImprove,
               suggestedFollowUp: lesson.suggestedFollowUp,
             };
             await setDoc(doc(db, \`users/\${lesson.studentId}/lessonRecords\`, newRecord.id), newRecord);
             importedCount++;
           }
         }
         alert(\`Zaimportowano \${importedCount} lekcji pomyślnie!\`);
      } else {
         alert('Nie znaleziono lekcji do zaimportowania.');
      }
    } catch (error: any) {
      console.error(error);
      alert('Błąd importu: ' + error.message);
    }
  };

  const handleGenerateFromNotes = async () => {
    if (!rawMeetingNotes.trim()) return;
    await generateSingleSummary({ notes: rawMeetingNotes });
  };

  const handleSaveLessonRecord = async`;

code = code.replace(regex, newCode);
fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('Patched AdminPanel.tsx');
