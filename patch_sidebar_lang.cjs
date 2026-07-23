const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const logoutRegex = /<button[\s\S]*?<LogOut size=\{20\} \/>[\s\S]*?<\/button>/;
const match = content.match(logoutRegex);

if (match) {
  const replacement = `
            <div className={\`flex \${isDesktopCollapsed ? 'md:flex-col' : 'flex-row'} gap-2\`}>
              <button 
                onClick={() => setLanguage(language === 'pl' ? 'en' : 'pl')}
                className={\`flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium border border-white/5 bg-black/20 hover:bg-black/40 text-content-muted hover:text-white group \${isDesktopCollapsed ? 'md:justify-center' : 'w-full'}\`}
                title={language === 'pl' ? 'Zmień język' : 'Change language'}
              >
                <div className="text-primary font-bold">{language === 'pl' ? 'EN' : 'PL'}</div>
                <span className={\`transition-all duration-300 group-hover:translate-x-0.5 \${isDesktopCollapsed ? 'md:hidden' : 'block'}\`}>{language === 'pl' ? 'Język / Language' : 'Language / Język'}</span>
              </button>

              ${match[0]}
            </div>
`;
  content = content.replace(match[0], replacement);
  fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
}
