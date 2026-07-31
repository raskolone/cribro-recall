const fs = require('fs');
let code = fs.readFileSync('components/admin/AssignVocabularyModal.tsx', 'utf8');

// 1. Add import
if (!code.includes("import AddResourceModal")) {
  code = code.replace(
    "import { cleanVocabularyTopic } from '../../utils/vocabulary';",
    "import { cleanVocabularyTopic } from '../../utils/vocabulary';\nimport AddResourceModal from './AddResourceModal';"
  );
}

// 2. Add state for the modal
if (!code.includes("isAddResourceModalOpen")) {
  const stateTarget = "const [isSubmitting, setIsSubmitting] = useState(false);";
  const stateReplacement = "const [isSubmitting, setIsSubmitting] = useState(false);\n  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);";
  code = code.replace(stateTarget, stateReplacement);
}

// 3. Add the button to the header
if (!code.includes("setIsAddResourceModalOpen(true)")) {
  const buttonTarget = `<div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted w-4 h-4" />`;
  const buttonReplacement = `<Button onClick={() => setIsAddResourceModalOpen(true)} className="bg-primary text-black font-bold shrink-0">
                <Sparkles size={16} className="mr-2" /> Wygeneruj zestaw AI
              </Button>
              <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted w-4 h-4" />`;
  code = code.replace(buttonTarget, buttonReplacement);
}

// 4. Render the modal component
if (!code.includes("<AddResourceModal")) {
  const renderTarget = `<AnimatePresence>
      {isOpen && (`;
  const renderReplacement = `<AnimatePresence>
      {isOpen && (
        <>
          <AddResourceModal
            isOpen={isAddResourceModalOpen}
            onClose={() => setIsAddResourceModalOpen(false)}
            onSuccess={() => {
              fetchAllVocabularyData();
            }}
          />`;
          
  const endRenderTarget = `</motion.div>
        </div>
      )}`;
  const endRenderReplacement = `</motion.div>
        </div>
        </>
      )}`;
      
  code = code.replace(renderTarget, renderReplacement);
  code = code.replace(endRenderTarget, endRenderReplacement);
}

fs.writeFileSync('components/admin/AssignVocabularyModal.tsx', code);
