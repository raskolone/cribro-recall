const fs = require('fs');
let content = fs.readFileSync('components/admin/AdminTestGenerator.tsx', 'utf8');

// add import
content = content.replace("import TestPreviewModal from './TestPreviewModal';", "import TestPreviewModal from './TestPreviewModal';\nimport ConfirmModal from '../ui/ConfirmModal';");

// add state
const statePattern = "const [assignedEditTest, setAssignedEditTest] = useState<StudentTest | null>(null);";
const stateReplacement = statePattern + "\n  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; testId: string | null}>({isOpen: false, testId: null});";
content = content.replace(statePattern, stateReplacement);

// replace handleDeleteTest
const deletePattern = /const handleDeleteTest = async \(testId: string\) => {[\s\S]*?};\n/;
const deleteReplacement = `const handleDeleteTest = async (testId: string) => {
    if (!user?.id || !testId) return;
    try {
      await deleteDoc(doc(db, \`users/\${user.id}/tests\`, testId));
      setTests(prev => prev.filter(t => t.id !== testId));
      setConfirmModal({isOpen: false, testId: null});
    } catch (err) {
      console.error(err);
      alert(i18n.t("Błąd podczas usuwania testu"));
    }
  };\n`;
content = content.replace(deletePattern, deleteReplacement);

// replace button click
const buttonPattern = /onClick=\{\(\) => test\.id && handleDeleteTest\(test\.id\)\}/;
const buttonReplacement = `onClick={() => test.id && setConfirmModal({isOpen: true, testId: test.id})}`;
content = content.replace(buttonPattern, buttonReplacement);

// add ConfirmModal to render
const modalPattern = /\{\/\* Modals for previewing and editing assigned tests \*\/\}/;
const modalReplacement = `<ConfirmModal
        isOpen={confirmModal.isOpen}
        title={i18n.t("Potwierdzenie usunięcia")}
        message={i18n.t("Czy na pewno chcesz usunąć ten przypisany test? Kursant nie będzie go już widział.")}
        confirmText={i18n.t("Usuń")}
        cancelText={i18n.t("Anuluj")}
        onConfirm={() => confirmModal.testId && handleDeleteTest(confirmModal.testId)}
        onCancel={() => setConfirmModal({isOpen: false, testId: null})}
      />\n      {/* Modals for previewing and editing assigned tests */}`;
content = content.replace(modalPattern, modalReplacement);

fs.writeFileSync('components/admin/AdminTestGenerator.tsx', content);
