const fs = require('fs');
let code = fs.readFileSync('components/admin/AssignVocabularyModal.tsx', 'utf8');

const buttonTarget = `<div className="relative w-full sm:w-80">
              <Search`;
const buttonReplacement = `<Button onClick={() => setIsAddResourceModalOpen(true)} className="bg-primary text-black font-bold shrink-0">
                <Sparkles size={16} className="mr-2" /> Wygeneruj zestaw (AI)
              </Button>
            <div className="relative w-full sm:w-80">
              <Search`;
code = code.replace(buttonTarget, buttonReplacement);

fs.writeFileSync('components/admin/AssignVocabularyModal.tsx', code);
