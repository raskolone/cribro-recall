const fs = require('fs');
let content = fs.readFileSync('components/tests/StudentTestsScreen.tsx', 'utf8');

// add imports
if (!content.includes('import Markdown')) {
    content = content.replace("import { Download } from \"lucide-react\";", "import { Download, Eye, X } from \"lucide-react\";\nimport Markdown from 'react-markdown';");
}

// add state for feedback modal
const statePattern = "const [activeTest, setActiveTest] = useState<StudentTest | null>(null);";
const stateReplacement = statePattern + "\n  const [feedbackTest, setFeedbackTest] = useState<StudentTest | null>(null);";
content = content.replace(statePattern, stateReplacement);

// add button to completed section
const downloadBtnPattern = /<Button \s*onClick=\{\(\) => exportTestToPDF\(test, i18n\.t\)\}\s*className="mt-3 w-full bg-base-100 hover:bg-base-200 text-content text-xs flex items-center justify-center gap-2 border border-white\/10"\s*size="sm"\s*>\s*<Download className="w-3\.5 h-3\.5" \/>\s*\{i18n\.t\("Pobierz raport \(PDF\)"\)\}\s*<\/Button>/g;

const replacementBtn = `<Button 
                      onClick={() => setFeedbackTest(test)}
                      className="mt-3 w-full bg-primary/20 hover:bg-primary/30 text-primary text-xs flex items-center justify-center gap-2 border border-primary/20"
                      size="sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {i18n.t("Zobacz feedback")}
                    </Button>
                    $&`;
                    
content = content.replace(downloadBtnPattern, replacementBtn);

// add modal html
const returnPattern = "return (\n    <div className=\"max-w-4xl mx-auto space-y-6\">";
const modalHtml = `
      {feedbackTest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-base-100 border border-white/10 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white">{feedbackTest.title} - Feedback</h3>
                <p className="text-content-muted text-sm mt-1">{i18n.t("Wynik:")} {feedbackTest.score}/{feedbackTest.maxScore} {i18n.t("pkt")}</p>
              </div>
              <button onClick={() => setFeedbackTest(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-content-muted hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 prose prose-invert max-w-none">
              {feedbackTest.aiFeedback ? (
                <Markdown>{feedbackTest.aiFeedback}</Markdown>
              ) : (
                <p className="text-content-muted italic">{i18n.t("Brak feedbacku AI dla tego testu.")}</p>
              )}
            </div>
            <div className="p-6 border-t border-white/10 flex justify-end shrink-0 gap-3">
              <Button onClick={() => exportTestToPDF(feedbackTest, i18n.t)} variant="secondary" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                {i18n.t("Pobierz raport (PDF)")}
              </Button>
              <Button onClick={() => setFeedbackTest(null)} className="bg-primary text-black hover:bg-primary/90">
                {i18n.t("Zamknij")}
              </Button>
            </div>
          </Card>
        </div>
      )}
`;
content = content.replace(returnPattern, returnPattern.replace("<div className=\"max-w-4xl mx-auto space-y-6\">", "<div className=\"max-w-4xl mx-auto space-y-6\">" + modalHtml));

fs.writeFileSync('components/tests/StudentTestsScreen.tsx', content);
