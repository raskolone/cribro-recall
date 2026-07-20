const fs = require('fs');
const path = 'components/dashboard/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldHeader = `          <div className="flex-1 space-y-6">
            {/* Welcome message / header for students */}
            <div className="p-6 border border-white/10 rounded-2xl bg-gradient-to-br from-primary/10 to-base-200/30 backdrop-blur-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">`;

const newHeader = `          <div className="flex-1 space-y-6">
            {/* Welcome message / header for students */}
            
            <AnimatePresence>
              {user?.hasNewVocabulary && (
                <motion.div 
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="relative group cursor-pointer"
                  onClick={() => changeView('ai-generator')}
                >
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
                  <div className="relative border border-primary/40 rounded-2xl bg-gradient-to-r from-primary/10 to-base-200/50 p-4 flex items-center justify-between backdrop-blur-md">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-base-100 animate-ping" />
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-base-100" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm md:text-base">
                          {language === 'pl' ? 'Masz nowy zestaw słownictwa! 🎉' : 'You have a new vocabulary set! 🎉'}
                        </h3>
                        <p className="text-primary/80 text-xs md:text-sm">
                          {language === 'pl' ? 'Twój nauczyciel udostępnił nowe słówka z lekcji. Kliknij, aby poćwiczyć.' : 'Your teacher shared new vocabulary. Click here to practice.'}
                        </p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary font-semibold rounded-lg text-sm transition-colors shrink-0">
                      {language === 'pl' ? 'Przejdź do ćwiczeń' : 'Go to exercises'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-6 border border-white/10 rounded-2xl bg-gradient-to-br from-primary/10 to-base-200/30 backdrop-blur-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">`;

content = content.replace(oldHeader, newHeader);
fs.writeFileSync(path, content);
console.log("Patched Dashboard pulsar");
