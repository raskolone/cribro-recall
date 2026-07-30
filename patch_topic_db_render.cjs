const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf-8');

const target = `      <div className="space-y-4">
        {chapters.map((chapter, cIdx) => (`;

const replacement = `      <div className="space-y-4">
        <h2 className="text-xl font-bold mt-8 mb-4">{i18n.t("Baza Słownictwa")}</h2>
        {vocabularySets.map((vSet: any) => (
          <Card key={vSet.id} className="p-0 overflow-hidden liquid-glass-tile border-white/10">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => setExpandedVocabSetId(expandedVocabSetId === vSet.id ? null : vSet.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  S
                </div>
                <h3 className="font-bold text-lg text-white">{vSet.name}</h3>
                <span className="text-sm text-content-muted">{vSet.words?.length || 0} słów</span>
              </div>
              <div>
                {expandedVocabSetId === vSet.id ? <ChevronUp size={24} className="text-content-muted" /> : <ChevronDown size={24} className="text-content-muted" />}
              </div>
            </div>
            <AnimatePresence>
              {expandedVocabSetId === vSet.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/10 bg-base-200/30 overflow-hidden"
                >
                  <div className="p-4 space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                    {vSet.words.map((w: any, idx: number) => (
                       <div key={idx} className="flex gap-2 text-sm">
                         <span className="font-bold text-primary w-1/3">{w.english}</span>
                         <span className="text-content-muted w-2/3">{w.polish}</span>
                       </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}

        <h2 className="text-xl font-bold mt-8 mb-4">{i18n.t("Baza Tematów (Gramatyka)")}</h2>
        {chapters.map((chapter, cIdx) => (`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
    console.log("Patched TopicDatabaseScreen.tsx (Render)");
} else {
    console.log("Target not found");
}
