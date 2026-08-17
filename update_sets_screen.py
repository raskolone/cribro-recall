import re

with open('components/flashcards/FlashcardSetsScreen.tsx', 'r') as f:
    content = f.read()

# Remove handleBulkImport
content = re.sub(r'const handleBulkImport = async \(\) => \{.*?\n  const handlePreviewSet', 'const handlePreviewSet', content, flags=re.DOTALL)

# Remove import state variables
content = re.sub(r'const \[isImportModalOpen, setIsImportModalOpen\] = useState\(false\);\n\s*const \[importText, setImportText\] = useState\(\'\'\);\n\s*const \[isImporting, setIsImporting\] = useState\(false\);\n', '', content)

# Remove the saveFlashcards destructuring since we won't need it
content = content.replace("const { getFlashcards, saveFlashcards } = useFlashcards();", "const { getFlashcards } = useFlashcards();")

# Remove Import Button
import_btn_pattern = r'<Button onClick=\{\(\) => setIsImportModalOpen\(true\)\} variant="secondary" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20">\s*\{language === \'pl\' \? \'Importuj z tekstu \(AI\)\' : \'Import from text \(AI\)\'\}\s*</Button>'
content = re.sub(import_btn_pattern, '', content)

# Remove Modal JSX
modal_jsx_pattern = r'\{isImportModalOpen && \(\s*<div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">.*?</div>\s*\)\}\s*'
content = re.sub(modal_jsx_pattern, '', content, flags=re.DOTALL)

# Add viewMode state
view_mode_state = "const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');"
if "viewMode" not in content:
    content = content.replace("const [isLoadingPreview, setIsLoadingPreview] = useState(false);", "const [isLoadingPreview, setIsLoadingPreview] = useState(false);\n  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');")

# Add viewMode toggle button next to Create new set button
view_toggle_btn = """<div className="flex bg-base-300 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-content-muted hover:text-white'}`}
            >
              ☰
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-content-muted hover:text-white'}`}
            >
              ⊞
            </button>
          </div>
          """

create_new_set_btn_pattern = r'(<Button onClick=\{handleCreateNewSet\} isLoading=\{isCreating\} className="shadow-lg shadow-primary/20">)'
content = re.sub(create_new_set_btn_pattern, view_toggle_btn + r'\1', content)

# Modify renderOtherSetCard to be either list or grid depending on viewMode
# Same for renderLessonSetRow

with open('components/flashcards/FlashcardSetsScreen.tsx', 'w') as f:
    f.write(content)

