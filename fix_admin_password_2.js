import fs from 'fs';

let adminContent = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

adminContent = adminContent.replace(
  `                      onClick={() => {
                        navigator.clipboard.writeText(newStudentPassword);
                        alert('Password copied to clipboard!');
                      }}`,
  `                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(newStudentPassword);
                        } catch(e) {}
                      }}`
);

fs.writeFileSync('components/admin/AdminPanel.tsx', adminContent);
console.log("Patched admin panel 2");
