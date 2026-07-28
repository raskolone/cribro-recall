const fs = require('fs');
let content = fs.readFileSync('components/admin/TestEditModal.tsx', 'utf8');

const statePattern = "const [questions, setQuestions] = useState<TestQuestion[]>([]);\n  const [isSaving, setIsSaving] = useState(false);";
const stateReplacement = statePattern + "\n  const [errorMsg, setErrorMsg] = useState('');";
content = content.replace(statePattern, stateReplacement);

const savePattern = /const handleSave = async \(\) => \{[\s\S]*?setIsSaving\(true\);/;
const saveReplacement = `const handleSave = async () => {
    setErrorMsg('');
    if (!title.trim()) return setErrorMsg(i18n.t("Podaj tytuł testu"));
    if (!dueDate) return setErrorMsg(i18n.t("Wybierz datę wykonania testu"));
    if (questions.length === 0) return setErrorMsg(i18n.t("Test musi posiadać przynajmniej jedno pytanie"));
    setIsSaving(true);`;
content = content.replace(savePattern, saveReplacement);

const errorPattern = /alert\(i18n\.t\("Błąd podczas zapisywania zmian w teście: "\) \+ err\.message\);/;
const errorReplacement = `setErrorMsg(i18n.t("Błąd podczas zapisywania: ") + err.message);`;
content = content.replace(errorPattern, errorReplacement);

const successPattern = /alert\(i18n\.t\("Zapisano zmiany w teście!"\)\);/;
const successReplacement = `// success handled by UI`;
content = content.replace(successPattern, successReplacement);

const htmlPattern = /\{\/\* Form Body \*\/\}\n        <div className="p-6 overflow-y-auto space-y-6 flex-1">/;
const htmlReplacement = `{/* Form Body */}\n        <div className="p-6 overflow-y-auto space-y-6 flex-1">\n          {errorMsg && <div className="p-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm">{errorMsg}</div>}`;
content = content.replace(htmlPattern, htmlReplacement);

fs.writeFileSync('components/admin/TestEditModal.tsx', content);
