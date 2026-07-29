const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const startSplit = '<div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2 space-y-2 pb-6">';
const endSplit = '</div>\n                                <div className="mt-4 pt-4 border-t border-white/10">';

const p1 = code.split(startSplit);
const pre = p1[0];
const p2 = p1[1].split(endSplit);
const modalContent = p2[0];
const post = endSplit + p2[1];

// Find "All" block
const mixRegex = /(\{\/\*\s*Option to select "All"\s*\*\/\}\s*<label[\s\S]*?<\/label>)/;
const mixMatch = mixRegex.exec(modalContent);
const mixBlock = mixMatch[1];

// Find Grammar block
const grammarRegex = /(\{\/\*\s*Grammar Options\s*\*\/\}\s*<div className="h-px w-full bg-white\/10 my-4"><\/div>\s*<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">\{language === 'pl' \? 'Gramatyka' : 'Grammar'\}<\/h4>[\s\S]*?<\/AnimatePresence>\s*<\/div>\s*\)\)\})/;
const grammarMatch = grammarRegex.exec(modalContent);
const grammarBlock = grammarMatch[1];

// Find Inne block
const inneRegex = /(<div className="h-px w-full bg-white\/10 my-4"><\/div>\s*<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">\{language === 'pl' \? 'Inne' : 'Other'\}<\/h4>[\s\S]*?Brak lekcji<\/div>\s*\)\})/;
const inneMatch = inneRegex.exec(modalContent);
let inneBlock = inneMatch[1];

// Remove original from modalContent? No, just rebuild it entirely
// Change "Inne" to "Moje lekcje"
inneBlock = inneBlock.replace(/'Inne' : 'Other'/, "'Moje lekcje' : 'My lessons'");
// Remove the top border for the first element
inneBlock = inneBlock.replace(/<div className="h-px w-full bg-white\/10 my-4"><\/div>\s*/, '');

const newMixBlock = `\n<div className="h-px w-full bg-white/10 my-4"></div>\n<h4 className="text-sm font-bold text-gray-400 px-2 mb-2 uppercase tracking-wider">{language === 'pl' ? 'Mix' : 'Mix'}</h4>\n` + mixBlock;

const newModalContent = `
                                  ${inneBlock}
                                  ${newMixBlock}
                                  ${grammarBlock}
                                `;

const newCode = pre + startSplit + newModalContent + post;
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', newCode);
console.log("Success");
