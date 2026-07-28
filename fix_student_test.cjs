const fs = require('fs');
let content = fs.readFileSync('components/tests/StudentTestsScreen.tsx', 'utf8');

const regex = /<Button \n                      onClick=\{\(\) => exportTestToPDF\(test, i18n.t\)\}\n                      className="mt-3 w-full bg-base-100 hover:bg-base-200 text-content text-xs flex items-center justify-center gap-2 border border-white\/10"\n                      size="sm"\n                    >\n                      <Download className="w-3.5 h-3.5" \/>\n                      \{i18n.t\("Pobierz raport \(PDF\)"\)\}\n                      <\/span>\n                    \)\}/g;

content = content.replace(regex, `<Button \n                      onClick={() => exportTestToPDF(test, i18n.t)}\n                      className="mt-3 w-full bg-base-100 hover:bg-base-200 text-content text-xs flex items-center justify-center gap-2 border border-white/10"\n                      size="sm"\n                    >\n                      <Download className="w-3.5 h-3.5" />\n                      {i18n.t("Pobierz raport (PDF)")}\n                    </Button>`);
fs.writeFileSync('components/tests/StudentTestsScreen.tsx', content);
