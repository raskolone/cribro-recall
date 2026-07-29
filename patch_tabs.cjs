const fs = require('fs');
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const targetTabs = `<div className="hidden md:flex bg-[#141d2a] border border-white/5 p-1 rounded-2xl gap-1 mb-7">`;
const repTabs = `{isTeacher && (
              <div className="hidden md:flex bg-[#141d2a] border border-white/5 p-1 rounded-2xl gap-1 mb-7">`;

const targetTabsEnd = `              </div>

              {/* Single Box Body content */}`;
const repTabsEnd = `              </div>
              )}

              {/* Single Box Body content */}`;

if (content.includes(targetTabs)) {
  content = content.replace(targetTabs, repTabs);
  content = content.replace(targetTabsEnd, repTabsEnd);
  fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
  console.log("Patched tabs!");
} else {
  console.log("Could not find target block for tabs!");
}
