sed -i '151i \
  useEffect(() => {\
    if (!selectedStudentId || selectedStudentId === "all") {\
      setStudentLessons([]);\
      setSelectedLessonId("manual");\
      return;\
    }\
    const loadLessons = async () => {\
      try {\
        const q = query(collection(db, "lessonRecords"), where("studentId", "==", selectedStudentId));\
        const snap = await getDocs(q);\
        const lessons: LessonRecord[] = [];\
        snap.forEach(d => lessons.push({ id: d.id, ...d.data() } as LessonRecord));\
        setStudentLessons(lessons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));\
      } catch (err) {\
        console.error(err);\
      }\
    };\
    loadLessons();\
  }, [selectedStudentId]);\
' components/dashboard/HomeworkScreen.tsx
