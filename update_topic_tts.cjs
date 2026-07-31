const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf8');

// Words
code = code.replace(
  /<span className="font-bold text-emerald-400 w-1\/2">\{w.english\}<\/span>/,
  `<div className="flex items-center justify-between w-1/2 pr-2">
                                <span className="font-bold text-emerald-400">{w.english}</span>
                                <TTSButtons text={w.english} />
                              </div>`
);

// Idioms
code = code.replace(
  /<h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">\s*\{idiom\.english\}\s*<\/h3>/,
  `<div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                    {idiom.english}
                  </h3>
                  <TTSButtons text={idiom.english} />
                </div>`
);

// Phrasals (I assume it has similar structure)
code = code.replace(
  /<h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">\s*\{item\.english\}\s*<\/h3>/,
  `<div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {item.english}
                  </h3>
                  <TTSButtons text={item.english} />
                </div>`
);

fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
