const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const start = content.indexOf('<NavLink \n            id="tour-homework"');
const endStr = '          </NavLink>';
const end = content.indexOf(endStr, start) + endStr.length;

if (start !== -1 && end !== -1) {
  const originalHW = content.substring(start, end);
  const newHW = `{!isTeacher && (\n  ${originalHW}\n          )}`;
  content = content.replace(originalHW, newHW);
  fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
  console.log('Replaced successfully.');
} else {
  console.log('Not found');
}
