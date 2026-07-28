const fs = require('fs');
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const regex = /\s*\{user\?\.role === "admin" && \(\s*<button\s*type="button"\s*onClick=\{\(\) => setIsTopicModalOpen\(true\)\}\s*className=\{`p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between min-h-\[56px\] border-white\/10 bg-\[#121824\] hover:bg-\[#17202e\] hover:border-white\/20 text-gray-300`\}\s*>\s*<div className="flex items-center gap-2\.5">\s*<Sparkles className="w-4 h-4 shrink-0 text-gray-400" \/>\s*<span className="font-semibold text-sm">\s*\{language === "pl" \? "Tematyka mieszana \(Demo\)" : "Mixed topics \(Demo\)"\}\s*<\/span>\s*<\/div>\s*<\/button>\s*\)\}/g;

content = content.replace(regex, '');
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
