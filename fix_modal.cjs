const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

// Insert state and effect
const stateToAdd = `
  const [isNewVocabModalOpen, setIsNewVocabModalOpen] = useState(false);

  useEffect(() => {
    if (user?.hasNewLesson || user?.hasNewVocabulary) {
      setIsNewVocabModalOpen(true);
    }
  }, [user?.hasNewLesson, user?.hasNewVocabulary]);

  const handleCloseVocabModal = () => {
    setIsNewVocabModalOpen(false);
    if (user?.id) {
      updateDoc(doc(db, 'users', user.id), { hasNewLesson: false, hasNewVocabulary: false }).catch(console.error);
    }
  };
`;

code = code.replace(
  /const \[isExerciseActive, setIsExerciseActive\] = useState\(false\);/,
  "const [isExerciseActive, setIsExerciseActive] = useState(false);\n" + stateToAdd
);

// Insert modal component
const modalToAdd = `
        <NewVocabularyModal 
          isOpen={isNewVocabModalOpen}
          onClose={handleCloseVocabModal}
          onViewHistory={() => {
            handleCloseVocabModal();
            setView('lesson-history');
          }}
        />
`;

code = code.replace(
  /\{renderContent\(\)\}/,
  "{renderContent()}\n" + modalToAdd
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
