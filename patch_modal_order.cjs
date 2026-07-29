const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// The modal content inside <div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2 space-y-2 pb-6">
// It currently contains:
// 1. {/* Option to select "All" */} -> <label ...> ... </label>
// 2. {/* Grammar Options */} <div ...></div> <h4 ...>Gramatyka</h4> ...
// 3. <div ...></div> <h4 ...>Inne</h4> ... specialTasks ... vocabularySets ...

const allRegex = /(\{\/\*\s*Option to select "All"\s*\*\/\}\s*<label[\s\S]*?<\/label>)/;
const grammarRegex = /(\{\/\*\s*Grammar Options\s*\*\/\}\s*<div className="h-px w-full bg-white\/10 my-4"><\/div>\s*<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">\{language === 'pl' \? 'Gramatyka' : 'Grammar'\}<\/h4>[\s\S]*?\{\/\*\s*End Grammar Options\s*\*\/\})/ // Wait, we don't have "End Grammar Options"

// Let's use string split and replace
const parts = code.split('<div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2 space-y-2 pb-6">');
if (parts.length === 2) {
    const afterOpen = parts[1];
    const footerSplit = afterOpen.split('</motion.div>\n                            </motion.div>\n                          )}');
    const modalContent = footerSplit[0];

    // Extract blocks
    const mixRegex = /(\{\/\*\s*Option to select "All"\s*\*\/\}\s*<label[\s\S]*?<\/label>)/;
    const matchMix = mixRegex.exec(modalContent);
    const mixBlock = matchMix[1];

    const grammarRegex = /(\{\/\*\s*Grammar Options\s*\*\/\}\s*<div className="h-px w-full bg-white\/10 my-4"><\/div>\s*<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">\{language === 'pl' \? 'Gramatyka' : 'Grammar'\}<\/h4>[\s\S]*?<\/AnimatePresence>\s*<\/div>\s*\)\)\})/;
    const matchGrammar = grammarRegex.exec(modalContent);
    const grammarBlock = matchGrammar[1];

    const inneRegex = /(<div className="h-px w-full bg-white\/10 my-4"><\/div>\s*<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">\{language === 'pl' \? 'Inne' : 'Other'\}<\/h4>[\s\S]*?<\/label>\s*\)\s*\}\s*\)\})/;
    const matchInne = inneRegex.exec(modalContent);
    let inneBlock = matchInne[1];

    // Change "Inne" to "Moje lekcje" and remove the top border since it's going to be first
    inneBlock = inneBlock.replace(/<div className="h-px w-full bg-white\/10 my-4"><\/div>\s*/, '');
    inneBlock = inneBlock.replace(/'Inne' : 'Other'/, "'Moje lekcje' : 'My lessons'");

    // Combine them in the new order:
    // 1. Inne (now Moje lekcje)
    // 2. Mix (with border)
    // 3. Grammar (with border)

    const newMixBlock = `\n<div className="h-px w-full bg-white/10 my-4"></div>\n<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">{language === 'pl' ? 'Mix' : 'Mix'}</h4>\n` + mixBlock;

    const newModalContent = `
                                  {/* Moje lekcje Options */}
                                  ${inneBlock}
                                  ${newMixBlock}
                                  ${grammarBlock}
                                </div>`;

    code = parts[0] + '<div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2 space-y-2 pb-6">' + newModalContent + '\n                            </motion.div>\n                          )}' + footerSplit[1];
    
    fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
    console.log("Success");
} else {
    console.log("Split failed", parts.length);
}
