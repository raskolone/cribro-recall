const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf8');

// import AddResourceModal
if (!code.includes("AddResourceModal")) {
  code = code.replace(
    "import Button from '../ui/Button';",
    "import Button from '../ui/Button';\nimport AddResourceModal from './AddResourceModal';"
  );
}

// Add states for db idioms, db phrasals, and modal open
if (!code.includes("const [isAddResourceModalOpen")) {
  code = code.replace(
    "const [isLoading, setIsLoading] = useState(true);",
    "const [isLoading, setIsLoading] = useState(true);\n  const [dbIdioms, setDbIdioms] = useState<IdiomItem[]>([]);\n  const [dbPhrasals, setDbPhrasals] = useState<PhrasalVerbItem[]>([]);\n  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);"
  );
}

// Update fetchData
if (!code.includes("global_idioms")) {
  const fetchInsert = `
      // Fetch global idioms
      const idiomsSnap = await getDocs(collection(db, 'global_idioms'));
      const fetchedIdioms = idiomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as IdiomItem));
      setDbIdioms(fetchedIdioms);

      // Fetch global phrasals
      const phrasalsSnap = await getDocs(collection(db, 'global_phrasals'));
      const fetchedPhrasals = phrasalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PhrasalVerbItem));
      setDbPhrasals(fetchedPhrasals);
`;
  code = code.replace(
    /const allVocabSets: any\[\] = \[\];/,
    "const allVocabSets: any[] = [];\n" + fetchInsert
  );
}

// Combine idioms and phrasals
code = code.replace(
  /const filteredIdioms = IDIOMS_DATABASE\.filter/,
  "const ALL_IDIOMS = [...IDIOMS_DATABASE, ...dbIdioms];\n  const filteredIdioms = ALL_IDIOMS.filter"
);

code = code.replace(
  /const filteredPhrasals = PHRASAL_VERBS_DATABASE\.filter/,
  "const ALL_PHRASALS = [...PHRASAL_VERBS_DATABASE, ...dbPhrasals];\n  const filteredPhrasals = ALL_PHRASALS.filter"
);

// Update count lengths
code = code.replace(/\{IDIOMS_DATABASE\.length\}/g, "{ALL_IDIOMS.length}");
code = code.replace(/\{PHRASAL_VERBS_DATABASE\.length\}/g, "{ALL_PHRASALS.length}");

// Add the "Dodaj nowe zasoby" button
// Add it inside the top right of the header
const headerTarget = `<div className="flex items-center gap-3">
            {selectedSection && (`;
const headerReplacement = `<div className="flex items-center gap-3">
            <Button onClick={() => setIsAddResourceModalOpen(true)} className="bg-primary text-black font-bold shadow-lg shadow-primary/20 hidden sm:flex">
              <Sparkles size={18} className="mr-2" /> Dodaj nowe zasoby
            </Button>
            {selectedSection && (`;
code = code.replace(headerTarget, headerReplacement);

// Render the modal
const modalTarget = `    <div className="max-w-6xl mx-auto space-y-8 pb-24">`;
const modalReplacement = `    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      <AddResourceModal
        isOpen={isAddResourceModalOpen}
        onClose={() => setIsAddResourceModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
      />`;
code = code.replace(modalTarget, modalReplacement);

fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
