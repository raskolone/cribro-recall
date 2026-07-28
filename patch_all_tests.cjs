const fs = require('fs');
let content = fs.readFileSync('components/admin/AllTestsTeacherView.tsx', 'utf8');

// add ConfirmModal import
if (!content.includes('import ConfirmModal from')) {
    content = content.replace("import TestEditModal from './TestEditModal';", "import TestEditModal from './TestEditModal';\nimport ConfirmModal from '../ui/ConfirmModal';");
}

// add state
const statePattern = "const [editTest, setEditTest] = useState<StudentTest | null>(null);";
const stateReplacement = statePattern + "\n  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; test: StudentTest | null}>({isOpen: false, test: null});";
content = content.replace(statePattern, stateReplacement);

// replace handleDeleteTest
const deletePattern = /const handleDeleteTest = async \(test: StudentTest\) => {[\s\S]*?};\n/;
const deleteReplacement = `const handleDeleteTest = async (test: StudentTest) => {
    if (!test.id || !test.studentId) return;
    try {
      await deleteDoc(doc(db, \`users/\${test.studentId}/tests\`, test.id));
      setTests(prev => prev.filter(t => t.id !== test.id));
      setConfirmModal({isOpen: false, test: null});
    } catch (err) {
      console.error(err);
      alert(i18n.t("Błąd podczas usuwania testu"));
    }
  };\n`;
content = content.replace(deletePattern, deleteReplacement);

// replace button click
const buttonPattern = /onClick=\{\(\) => handleDeleteTest\(test\)\}/g;
const buttonReplacement = `onClick={() => setConfirmModal({isOpen: true, test})}`;
content = content.replace(buttonPattern, buttonReplacement);

// add ConfirmModal to render
const modalPattern = /\{\/\* Modals \*\/\}/;
const modalReplacement = `<ConfirmModal
        isOpen={confirmModal.isOpen}
        title={i18n.t("Potwierdzenie usunięcia")}
        message={i18n.t("Czy na pewno chcesz usunąć ten przypisany test? Kursant nie będzie go już widział.")}
        confirmText={i18n.t("Usuń")}
        cancelText={i18n.t("Anuluj")}
        onConfirm={() => confirmModal.test && handleDeleteTest(confirmModal.test)}
        onCancel={() => setConfirmModal({isOpen: false, test: null})}
      />\n      {/* Modals */}`;
content = content.replace(modalPattern, modalReplacement);

fs.writeFileSync('components/admin/AllTestsTeacherView.tsx', content);
