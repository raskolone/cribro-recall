const fs = require('fs');
let code = fs.readFileSync('components/admin/AssignVocabularyModal.tsx', 'utf8');

const renderTarget = `<AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">`;

const renderReplacement = `<AnimatePresence>
      {isOpen && (
        <>
        <AddResourceModal
            isOpen={isAddResourceModalOpen}
            onClose={() => setIsAddResourceModalOpen(false)}
            onSuccess={() => {
              fetchAllVocabularyData();
            }}
          />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">`;

code = code.replace(renderTarget, renderReplacement);
code = code.replace(
  `</motion.div>
        </div>
      )}
    </AnimatePresence>`,
  `</motion.div>
        </div>
        </>
      )}
    </AnimatePresence>`
);

fs.writeFileSync('components/admin/AssignVocabularyModal.tsx', code);
