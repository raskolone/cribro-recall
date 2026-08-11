sed -i '176,186c\
    try {\
      let finalTopic = aiTopic;\
      let finalPrompt = aiPrompt;\
      if (selectedLessonId !== "manual") {\
        const lesson = studentLessons.find(l => l.id === selectedLessonId);\
        if (lesson) {\
          finalPrompt += `\\nBazuj na słownictwie z tej lekcji:\\n${lesson.vocabularyText}\\nTemat lekcji: ${lesson.topic}`;\
          if (!finalTopic) finalTopic = lesson.topic;\
        }\
      }\
\
      if (homeworkType === "translation") {\
        const wordsArr = finalTopic ? finalTopic.split(",").map(s => s.trim()).filter(Boolean) : [];\
        const result = await generateTranslationExercises(\
          aiLevel,\
          wordsArr,\
          finalPrompt,\
          finalTopic,\
          "",\
          aiCount\
        );' components/dashboard/HomeworkScreen.tsx

sed -i 's/          aiTopic,/          finalTopic,/g' components/dashboard/HomeworkScreen.tsx
sed -i 's/          aiPrompt/          finalPrompt/g' components/dashboard/HomeworkScreen.tsx
