const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf8');

const targetRender = `<div className="space-y-3">
            {filteredVocabSets.map((vSet: any) => (
              <Card key={vSet.id} className="p-0 overflow-hidden liquid-glass-tile border-white/10">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedVocabSetId(expandedVocabSetId === vSet.id ? null : vSet.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      S
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-white">{vSet.name}</h3>
                        <span className="text-xs bg-white/10 text-content-muted px-2 py-0.5 rounded">
                          Kursant: {vSet.studentName}
                        </span>
                      </div>
                      <span className="text-xs text-emerald-400 font-mono">{vSet.words?.length || 0} słówek</span>
                    </div>
                  </div>
                  <div>
                    {expandedVocabSetId === vSet.id ? <ChevronUp size={20} className="text-emerald-400" /> : <ChevronDown size={20} className="text-content-muted" />}
                  </div>
                </div>`;

const newRender = `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVocabSets.map((vSet: any) => (
              <Card key={vSet.id} className="p-0 overflow-hidden liquid-glass-tile border-white/10 flex flex-col justify-between h-full">
                <div className="p-4 flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                      <Layers size={18} />
                    </div>
                    <span className="text-[10px] bg-white/10 text-content-muted px-2 py-0.5 rounded uppercase tracking-widest text-right line-clamp-1">
                      {vSet.studentName}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-lg text-white leading-tight mb-1 line-clamp-2">{vSet.name}</h3>
                    <span className="text-xs text-emerald-400 font-mono font-bold">{vSet.words?.length || 0} słówek</span>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
                    <select 
                      id={\`select-\${vSet.id}\`} 
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-emerald-500/50"
                    >
                      <option value="">Wybierz kursanta...</option>
                      {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    
                    <Button 
                      onClick={() => handleAssignSetToUser(vSet, (document.getElementById(\`select-\${vSet.id}\`) as HTMLSelectElement)?.value)} 
                      className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 transition-all font-bold"
                    >
                      <Sparkles size={16} className="mr-2" />
                      Przypisz zestaw
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => setExpandedVocabSetId(expandedVocabSetId === vSet.id ? null : vSet.id)}
                      className="w-full text-xs text-content-muted"
                    >
                      {expandedVocabSetId === vSet.id ? 'Ukryj słówka' : 'Pokaż słówka'}
                    </Button>
                  </div>
                </div>`;

code = code.replace(targetRender, newRender);

const writeBatchImportTarget = "import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';";
const writeBatchImportReplacement = "import { doc, getDoc, setDoc, getDocs, collection, writeBatch } from 'firebase/firestore';";
code = code.replace(writeBatchImportTarget, writeBatchImportReplacement);

const handleAssignTarget = "const fetchData = async () => {";
const handleAssignReplacement = `const handleAssignSetToUser = async (vSet: any, targetUserId: string) => {
    if (!targetUserId) {
      alert('Wybierz kursanta z listy.');
      return;
    }
    const targetUser = allUsers.find(u => u.id === targetUserId);
    try {
      setIsSaving(true);
      const newSetId = \`set-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      const newSetData = {
        id: newSetId,
        userId: targetUserId,
        title: vSet.name,
        description: \`Przypisano przez nauczyciela dla \${targetUser?.name || 'Kursanta'}\`,
        isPublic: false,
        cardCount: vSet.words.length,
        assignedByTeacher: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const batch = writeBatch(db);
      
      batch.set(doc(db, \`sets/\${newSetId}\`), newSetData);
      batch.set(doc(db, \`users/\${targetUserId}/wordSets/\${newSetId}\`), newSetData);
      
      vSet.words.forEach((w: any, idx: number) => {
        const cardRef = doc(db, \`sets/\${newSetId}/flashcards\`, \`card-\${idx}-\${Date.now()}\`);
        batch.set(cardRef, {
          term: w.english,
          definition: w.polish,
          createdAt: new Date().toISOString()
        });
      });
      
      batch.update(doc(db, 'users', targetUserId), { hasNewVocabulary: true });
      
      await batch.commit();
      alert('Zestaw został przypisany pomyślnie!');
    } catch (e) {
      console.error(e);
      alert('Wystąpił błąd podczas przypisywania.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const fetchData = async () => {`;
code = code.replace(handleAssignTarget, handleAssignReplacement);

fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
