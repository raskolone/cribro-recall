const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf8');

code = code.replace(
  /<h3 className="text-xl font-extrabold text-white group-hover:text-cyan-300 transition-colors">\s*\{item\.verb\}\s*<\/h3>/,
  `<div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                    {item.verb}
                  </h3>
                  <TTSButtons text={item.verb} />
                </div>`
);

fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
