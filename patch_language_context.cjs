const fs = require('fs');

let content = fs.readFileSync('context/LanguageContext.tsx', 'utf8');

// Replace the context provider return statement to include i18n logic and a key
content = content.replace(/export const LanguageProvider: React.FC<\{ children: ReactNode \}> = \(\{ children \}\) => \{/, 
`import i18n from '../i18n';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {`);

content = content.replace(/const handleSetLanguage = \(lang: Language\) => \{[\s\S]*?\};/, 
`const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
    i18n.changeLanguage(lang);
  };`);

// also sync initial language
content = content.replace(/setLanguage\(browserLang\);/, 
`setLanguage(browserLang);
      i18n.changeLanguage(browserLang);`);

content = content.replace(/setLanguage\(savedLang\);/, 
`setLanguage(savedLang);
      i18n.changeLanguage(savedLang);`);

// modify the provider to render children with a key, forcing remount
content = content.replace(/<LanguageContext\.Provider value=\{\{ language, setLanguage: handleSetLanguage, t \}\}>[\s\S]*?<\/LanguageContext\.Provider>/, 
`<LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      <div key={language} style={{ display: 'contents' }}>
        {children}
      </div>
    </LanguageContext.Provider>`);

// Now modify the `t` function to also fall back to i18n
content = content.replace(/const t = \(key: string\): string => \{[\s\S]*?return translations\[language\]\[key as keyof typeof translations\['en'\]\] \|\| key;\s*\};/, 
`const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || i18n.t(key);
  };`);

fs.writeFileSync('context/LanguageContext.tsx', content);

