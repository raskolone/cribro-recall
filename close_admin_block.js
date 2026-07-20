import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /Skasuj konto\n                        <\/Button>\n                      <\/div>\n                    <\/div>\n                  <\/div>\n                <\/div>/,
  "Skasuj konto\n                        </Button>\n                      </div>\n                    </div>\n                  </div>\n                </div>\n              )}"
);

fs.writeFileSync(file, content);
console.log("Closed admin block");
