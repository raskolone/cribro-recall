const fs = require('fs');

let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const target = `<div className={\`flex \${isDesktopCollapsed ? 'md:flex-col' : 'flex-row'} gap-2\`}>
              <button 
                onClick={() => setLanguage(language === 'pl' ? 'en' : 'pl')}
                className={\`flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium border border-white/5 bg-black/20 hover:bg-black/40 text-content-muted hover:text-white group \${isDesktopCollapsed ? 'md:justify-center' : 'w-full'}\`}
                title={language === 'pl' ? 'Switch to English' : 'Zmień na Polski'}
              >
                <div className="text-xl leading-none grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">{language === 'pl' ? '🇬🇧' : '🇵🇱'}</div>
                <span className={\`transition-all duration-300 group-hover:translate-x-0.5 \${isDesktopCollapsed ? 'md:hidden' : 'block'}\`}>{language === 'pl' ? 'English' : 'Polski'}</span>
              </button>`;

const replacement = `<div className={\`flex \${isDesktopCollapsed ? 'md:flex-col' : 'flex-row'} gap-2\`}>
              <div className={\`flex items-center p-1 bg-black/30 rounded-xl border border-white/5 \${isDesktopCollapsed ? 'flex-col mx-auto' : 'w-full'}\`}>
                <button 
                  onClick={() => setLanguage('en')}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all \${language === 'en' ? 'bg-white/10 shadow-sm' : 'opacity-50 hover:opacity-100 hover:bg-white/5'}\`}
                  title="English"
                >
                  <span className="text-lg leading-none">🇬🇧</span>
                  <span className={\`font-bold text-sm \${isDesktopCollapsed ? 'md:hidden' : 'block'}\`}>EN</span>
                </button>
                <button 
                  onClick={() => setLanguage('pl')}
                  className={\`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all \${language === 'pl' ? 'bg-white/10 shadow-sm' : 'opacity-50 hover:opacity-100 hover:bg-white/5'}\`}
                  title="Polski"
                >
                  <span className="text-lg leading-none">🇵🇱</span>
                  <span className={\`font-bold text-sm \${isDesktopCollapsed ? 'md:hidden' : 'block'}\`}>PL</span>
                </button>
              </div>`;

content = content.replace(target, replacement);

fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
