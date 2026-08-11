sed -i '70i \  const [studentLessons, setStudentLessons] = useState<LessonRecord[]>([]);\
  const [selectedLessonId, setSelectedLessonId] = useState<string>("manual");\
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);\
  const [bulkText, setBulkText] = useState("");\
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);\
' components/dashboard/HomeworkScreen.tsx
