const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

// 1. Root padding
code = code.replace(
  'return (\n    <div className="space-y-6">',
  'return (\n    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28 min-w-0">'
);

// 2. Banner padding
code = code.replace(
  '<div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${',
  '<div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 ${'
);

// 3. Grid class
code = code.replace(
  '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">',
  '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-4.5">'
);

// 4. Tile component inside map
const oldTileHtml = `              <div
                key={tile.id}
                onClick={() => handleTileClick(tile.id)}
                className={\`p-6 cursor-pointer flex flex-col justify-between liquid-glass-tile \${
                  isActive
                    ? 'border-primary shadow-[0_0_25px_rgba(114,240,180,0.35)] ring-2 ring-primary/20 scale-105 z-10'
                    : selectedUser
                    ? ''
                    : 'opacity-80'
                }\`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={\`p-2.5 rounded-xl \${
                      isActive
                        ? 'bg-primary text-black'
                        : 'bg-base-100/80 text-primary border border-white/10 group-hover:border-primary/40'
                    }\`}>
                      <IconComp size={22} />
                    </div>
                    <span className={\`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border \${
                      isActive
                        ? 'bg-primary/20 text-primary border-primary/40 font-mono'
                        : 'bg-base-100/60 text-content-muted border-white/5'
                    }\`}>
                      {isActive ? 'Aktywny' : tile.badge}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-white group-hover:text-primary transition-colors">
                    {tile.title}
                  </h3>
                  <p className="text-xs text-content-muted mt-1 leading-relaxed">
                    {tile.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold">
                  <span className={isActive ? 'text-primary font-bold' : 'text-content-muted'}>
                    {isActive ? 'Przeglądasz ten widok' : selectedUser ? 'Otwórz widok' : 'Wybierz kursanta'}
                  </span>
                  <ChevronRight size={16} className={\`transition-transform group-hover:translate-x-1 \${isActive ? 'text-primary' : 'text-content-muted'}\`} />
                </div>
              </div>`;

const newTileHtml = `              <div
                key={tile.id}
                onClick={() => handleTileClick(tile.id)}
                className={\`p-4 sm:p-4.5 cursor-pointer flex flex-col justify-between liquid-glass-tile select-none \${
                  isActive
                    ? 'border-primary/80 shadow-[0_0_24px_rgba(114,240,180,0.25)] ring-1 ring-primary/40 bg-[#0e1524] z-10'
                    : selectedUser
                    ? 'hover:border-primary/50'
                    : 'opacity-85 hover:border-amber-500/40'
                }\`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={\`p-2 rounded-xl transition-colors \${
                      isActive
                        ? 'bg-primary text-black shadow-[0_0_12px_rgba(114,240,180,0.4)]'
                        : 'bg-base-100/90 text-primary border border-white/10 group-hover:border-primary/40'
                    }\`}>
                      <IconComp size={18} />
                    </div>
                    <span className={\`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border font-mono \${
                      isActive
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-base-100/70 text-content-muted border-white/5'
                    }\`}>
                      {isActive ? 'Aktywny' : tile.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-primary transition-colors truncate">
                    {tile.title}
                  </h3>
                  <p className="text-xs text-content-muted mt-0.5 leading-snug line-clamp-2 min-h-[2.2rem]">
                    {tile.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-semibold">
                  <span className={isActive ? 'text-primary font-bold' : 'text-content-muted'}>
                    {isActive ? 'Przeglądasz ten widok' : selectedUser ? 'Otwórz widok' : 'Wybierz kursanta'}
                  </span>
                  <ChevronRight size={14} className={\`transition-transform group-hover:translate-x-0.5 \${isActive ? 'text-primary' : 'text-content-muted'}\`} />
                </div>
              </div>`;

if (code.includes(oldTileHtml)) {
  code = code.replace(oldTileHtml, newTileHtml);
  fs.writeFileSync('components/admin/AdminPanel.tsx', code);
  console.log('Successfully updated AdminPanel.tsx tile markup and styles');
} else {
  console.log('Direct string match failed, trying normalized replacement');
  // fallback normalized match
  const startIdx = code.indexOf('key={tile.id}');
  const endIdx = code.indexOf('</div>\n            );\n          })');
  if (startIdx !== -1 && endIdx !== -1) {
    const pre = code.substring(0, code.lastIndexOf('<div', startIdx));
    const post = code.substring(endIdx + '</div>'.length);
    code = pre + newTileHtml + post;
    fs.writeFileSync('components/admin/AdminPanel.tsx', code);
    console.log('Replaced via index search in AdminPanel.tsx');
  } else {
    console.log('Could not find tile block via index search');
  }
}
