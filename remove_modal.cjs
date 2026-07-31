const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

// Remove import
code = code.replace(/import NewVocabularyModal from '\.\/NewVocabularyModal';\n/, '');

// Remove state and effects
const logicToRemove = `  const [isNewVocabModalOpen, setIsNewVocabModalOpen] = useState(false);

  useEffect(() => {
    if ((user?.hasNewLesson || user?.hasNewVocabulary) && localStorage.getItem('dismissed_modal_status') !== 'true') {
      setIsNewVocabModalOpen(true);
    } else if (!user?.hasNewLesson && !user?.hasNewVocabulary) {
      localStorage.removeItem('dismissed_modal_status');
    }
  }, [user?.hasNewLesson, user?.hasNewVocabulary]);

  const handleCloseVocabModal = () => {
    setIsNewVocabModalOpen(false);
    localStorage.setItem('dismissed_modal_status', 'true');
  };

  const handleGoToHistory = () => {
    setIsNewVocabModalOpen(false);
    localStorage.setItem('dismissed_modal_status', 'true');
    if (user?.id) {
      updateDoc(doc(db, 'users', user.id), { hasNewLesson: false, hasNewVocabulary: false }).catch(console.error);
    }
    setView('lesson-history');
  };`;

code = code.replace(logicToRemove, '');

// Remove JSX
const jsxToRemove = `
        <NewVocabularyModal 
          isOpen={isNewVocabModalOpen}
          onClose={handleCloseVocabModal}
          onViewHistory={handleGoToHistory}
        />`;

code = code.replace(jsxToRemove, '');

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
