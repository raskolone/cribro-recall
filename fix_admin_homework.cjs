const fs = require('fs');
let content = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const oldHomework = `<HomeworkScreen 
                 // We need to pass the selected student to HomeworkScreen if possible.
                 // HomeworkScreen handles its own data fetching, but usually it's tied to the logged in user or admin can assign.
              />`;
              
const newHomework = `<HomeworkScreen 
                initialStudentId={selectedUser?.id || null}
              />`;

if (content.includes(oldHomework)) {
  content = content.replace(oldHomework, newHomework);
  fs.writeFileSync('components/admin/AdminPanel.tsx', content);
  console.log('AdminPanel passes initialStudentId');
}
