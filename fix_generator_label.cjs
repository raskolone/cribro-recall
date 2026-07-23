const fs = require('fs');
const file = 'components/admin/AdminTestGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldStr = `            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">Źródła materiału do testu</label>
              </div>

            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">Źródła materiału do testu</label>`;

const newStr = `            <div>
              <label className="block text-sm font-bold text-content-muted mb-1">Źródła materiału do testu</label>`;

content = content.replace(oldStr, newStr);
fs.writeFileSync(file, content);
