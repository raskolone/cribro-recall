const fs = require('fs');
const file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `activeTab === 'ai' 
                      ? 'bg-[#222d3e] text-white shadow-sm border border-white/10' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'`;
const replacement1 = `activeTab === 'ai' 
                      ? 'liquid-glass-button !rounded-xl !text-white shadow-[0_0_20px_rgba(114,240,180,0.3)] !border-primary/50' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'`;

content = content.replace(target1, replacement1);

const target2 = 'className="bg-[#121824] border border-white/10 rounded-2xl p-5 space-y-4"';
const replacement2 = 'className="bg-[#121824] border border-primary/20 rounded-2xl p-5 space-y-4 animate-pulsar-soft"';

content = content.replace(target2, replacement2);

fs.writeFileSync(file, content);
