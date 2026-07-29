const fs = require('fs');
let file = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// Find the mobile header in setup
const headerStart = `                    {/* Header */}`;
const headerEnd = `                    {/* Content Container */}`;
const headerBlock = file.substring(file.indexOf(headerStart), file.indexOf(headerEnd));

// Remove it from setup
file = file.replace(headerBlock, "");

// Add the global mobile header
const globalHeader = `
      {/* GLOBAL MOBILE HEADER */}
      <div className="md:hidden pt-6 pb-2 px-6 flex items-center justify-between bg-transparent z-40">
        <button 
          onClick={onOpenSidebar}
          className="p-2 -ml-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          {step === 'setup' ? (language === 'pl' ? 'Czas na trening' : 'Time for training') : 
           step === 'practice' ? (language === 'pl' ? 'Ćwiczenie' : 'Practice') :
           step === 'results' ? (language === 'pl' ? 'Wyniki' : 'Results') : 
           (language === 'pl' ? 'Sukces' : 'Success')}
        </h2>
        <div className="flex items-center gap-2">
          {step === 'practice' && (
            <button
              onClick={() => {
                showConfirm(
                  language === 'pl' ? 'Zakończ trening' : 'End session',
                  language === 'pl' ? 'Czy na pewno chcesz zakończyć sesję nauki? Dotychczasowe odpowiedzi zostaną ocenione.' : 'Are you sure you want to end this study session? Your answers will be evaluated.',
                  () => {
                    closeConfirm();
                    handleEvaluate();
                  }
                );
              }}
              className="p-2 text-content-muted hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
          {onChangeView ? (
            <MobileTopMenu 
              currentView="dashboard" 
              onChangeView={onChangeView}
              isExerciseActive={step === 'practice' || step === 'results'}
              onConfirmEndSession={(onEnd) => {
                showConfirm(
                  language === 'pl' ? 'Zakończ trening' : 'End session',
                  language === 'pl' ? 'Czy na pewno chcesz zakończyć sesję nauki? Dotychczasowe odpowiedzi zostaną ocenione.' : 'Are you sure you want to end this study session? Your answers will be evaluated.',
                  () => {
                    closeConfirm();
                    onEnd();
                  }
                );
              }}
            />
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>
`;

// Insert right after <AnimatePresence> tag ends (or before it)
file = file.replace(
  `      <AnimatePresence>`,
  globalHeader + `\n      <AnimatePresence>`
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', file);
