const fs = require('fs');

let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// 1. Inject Help Button into Top Bar on left
const oldTopBar = `<div className="w-full flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                        </div>`;

const newTopBar = `<div className="w-full flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {onShowOnboarding && (
                            <button
                              type="button"
                              id="tour-help-button"
                              onClick={onShowOnboarding}
                              title={language === 'pl' ? 'Pomoc i Przewodnik po aplikacji' : 'Help & App Guide'}
                              className="group relative flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 hover:text-white shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all duration-300 active:scale-95 cursor-pointer"
                            >
                              <HelpCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                              <span className="text-xs font-bold font-sans tracking-wide">
                                {language === 'pl' ? 'Pomoc' : 'Help'}
                              </span>
                            </button>
                          )}
                        </div>`;

if (code.includes(oldTopBar)) {
  code = code.replace(oldTopBar, newTopBar);
  console.log("Replaced top bar successfully");
} else {
  console.log("Could not find exact old top bar, trying regex");
  code = code.replace(/<div className="flex flex-wrap items-center gap-1\.5">\s*<\/div>/, `<div className="flex flex-wrap items-center gap-1.5">
                          {onShowOnboarding && (
                            <button
                              type="button"
                              id="tour-help-button"
                              onClick={onShowOnboarding}
                              title={language === 'pl' ? 'Pomoc i Przewodnik po aplikacji' : 'Help & App Guide'}
                              className="group relative flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 hover:text-white shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all duration-300 active:scale-95 cursor-pointer"
                            >
                              <HelpCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                              <span className="text-xs font-bold font-sans tracking-wide">
                                {language === 'pl' ? 'Pomoc' : 'Help'}
                              </span>
                            </button>
                          )}
                        </div>`);
}

// 2. Add id="tour-generator-header"
code = code.replace(
  '<div className="space-y-1.5 max-w-lg mx-auto text-center w-full pt-1">',
  '<div id="tour-generator-header" className="space-y-1.5 max-w-lg mx-auto text-center w-full pt-1">'
);

// 3. Add id="tour-mode-puzzle" to Układanka card
code = code.replace(
  `{/* Card 1: Układanka */}
                        <div className="relative group">`,
  `{/* Card 1: Układanka */}
                        <div id="tour-mode-puzzle" className="relative group">`
);

// 4. Add id="tour-mode-typing" to Prawdziwe wyzwanie card
code = code.replace(
  `{/* Card 2: Prawdziwe wyzwanie */}
                        <div className="relative group">`,
  `{/* Card 2: Prawdziwe wyzwanie */}
                        <div id="tour-mode-typing" className="relative group">`
);

// 5. Add id="tour-vocab-source" to Material Source container
code = code.replace(
  `{/* LOWER SECTION: EXPANDED BARS (ŹRÓDŁO MATERIAŁU & ILOŚĆ ZDAŃ STACKED VERTICALLY - DESKTOP ONLY) */}
                    <div className="hidden sm:flex flex-col gap-4 w-full">`,
  `{/* LOWER SECTION: EXPANDED BARS (ŹRÓDŁO MATERIAŁU & ILOŚĆ ZDAŃ STACKED VERTICALLY - DESKTOP ONLY) */}
                    <div id="tour-vocab-source" className="hidden sm:flex flex-col gap-4 w-full">`
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log("Done patching AIExerciseGeneratorScreen.tsx");
