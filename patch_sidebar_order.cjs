const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const target = `            <div className={\`flex \${isDesktopCollapsed ? 'md:flex-col' : 'flex-row'} gap-2\`}>
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
              </div>
              <button onClick={() => logout()} className={\`group relative z-10 hover:z-20 w-full flex items-center \${isDesktopCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-3 text-sm font-bold rounded-xl transition-all duration-200 border border-transparent text-red-400 hover:bg-red-500/10 active:scale-[0.98]\`}>
              <div className={\`flex items-center justify-center transition-transform duration-300 \${isDesktopCollapsed ? 'mr-3 md:mr-0' : 'mr-3'} group-hover:scale-110\`}>
                <LogOut size={20} />
              </div>
              <span className={\`transition-all duration-300 group-hover:translate-x-0.5 \${isDesktopCollapsed ? 'md:hidden' : 'block'}\`}>{\language === 'pl' ? 'Wyloguj się' : 'Logout'}</span>
            </button>
            </div>`;

const replacement = `            <div className={\`flex flex-col gap-2\`}>
              <button onClick={() => logout()} className={\`group relative z-10 hover:z-20 w-full flex items-center \${isDesktopCollapsed ? 'px-4 md:px-0 md:justify-center' : 'px-4'} py-3 text-sm font-bold rounded-xl transition-all duration-200 border border-transparent text-red-400 hover:bg-red-500/10 active:scale-[0.98]\`}>
                <div className={\`flex items-center justify-center transition-transform duration-300 \${isDesktopCollapsed ? 'mr-3 md:mr-0' : 'mr-3'} group-hover:scale-110\`}>
                  <LogOut size={20} />
                </div>
                <span className={\`transition-all duration-300 group-hover:translate-x-0.5 \${isDesktopCollapsed ? 'md:hidden' : 'block'}\`}>{language === 'pl' ? 'Wyloguj się' : 'Logout'}</span>
              </button>
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
              </div>
            </div>`;

content = content.replace(target.replace(/\\language/g, 'language'), replacement);
fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
