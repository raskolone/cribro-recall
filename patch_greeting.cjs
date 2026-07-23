const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

if (!code.includes("const [slogan, setSlogan] = useState('');")) {
  code = code.replace(
    "const [greeting, setGreeting] = useState('');",
    "const [greeting, setGreeting] = useState('');\n  const [slogan, setSlogan] = useState('');"
  );
}

const sloganLogic = `
    let slogans: string[] = [];
    if (language === 'pl') {
       if (user?.streakCount && user.streakCount > 2) {
          slogans = [
            'Niesamowita passa! Masz już ' + user.streakCount + ' dni z rzędu. Oby tak dalej!',
            'Twój płomień płonie! ' + user.streakCount + ' dni nauki z rzędu. Lecimy dalej?',
            'Znakomita regularność! Co dzisiaj szlifujemy?'
          ];
       } else if (user?.loginCount && user.loginCount > 10) {
          slogans = [
            'Jesteś tu już stałym bywalcem! Gotowy na kolejne wyzwanie?',
            'Świetnie Ci idzie, nie zwalniaj tempa!',
            'Gotowy pobić swoje kolejne rekordy?'
          ];
       } else {
          slogans = [
            'Co dzisiaj poćwiczymy?',
            'Kolejny dzień, kolejna szansa na nową wiedzę!',
            'Pamiętaj, że małe kroki prowadzą do wielkich sukcesów!',
            'Masz chwilę? Zróbmy szybką powtórkę.'
          ];
       }
    } else {
       if (user?.streakCount && user.streakCount > 2) {
          slogans = [
            'Amazing streak! ' + user.streakCount + ' days in a row. Keep it up!',
            'Your flame is burning! ' + user.streakCount + ' days of learning. Ready for more?',
            'Great consistency! What are we practicing today?'
          ];
       } else if (user?.loginCount && user.loginCount > 10) {
          slogans = [
            'You are a regular here! Ready for another challenge?',
            'You\\'re doing great, keep up the pace!',
            'Ready to beat your own records?'
          ];
       } else {
          slogans = [
            'What are we practicing today?',
            'Another day, another chance to learn something new!',
            'Remember, small steps lead to big success!',
            'Got a minute? Let\\'s do a quick review.'
          ];
       }
    }
    setSlogan(slogans[Math.floor(Math.random() * slogans.length)]);
`;

if (!code.includes("setSlogan(")) {
  code = code.replace(
    "setGreeting(options[Math.floor(Math.random() * options.length)]);\n  }, [user?.firstName, language]);",
    "setGreeting(options[Math.floor(Math.random() * options.length)]);\n" + sloganLogic + "\n  }, [user?.firstName, language, user?.streakCount, user?.loginCount]);"
  );
}

const headerRegex = /<header className="relative z-50 flex justify-between items-center mb-6 p-4 rounded-2xl liquid-glass-card">[\s\S]*?<\/header>/;

const newHeader = `<header className="relative z-50 flex justify-between items-center mb-6 p-4 rounded-2xl liquid-glass-card">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-content-muted hover:text-white rounded-lg hover:bg-white/5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {greeting}
                </h1>
                {user?.streakCount !== undefined && user?.streakCount > 0 && (
                  <div className="flex items-center gap-1.5 ml-2 bg-black/20 px-3 py-1.5 rounded-full border border-base-300 shadow-sm" title="Your current streak">
                    <motion.span 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }} 
                      transition={{ repeat: Infinity, duration: 1.5 }} 
                      className="text-orange-500 text-lg drop-shadow-[0_0_8px_rgba(255,165,0,0.8)] inline-block"
                    >
                      🔥
                    </motion.span>
                    <span className="font-bold text-sm text-white">{user.streakCount}</span>
                  </div>
                )}
              </div>
              {user?.role !== 'admin' && user?.role !== 'teacher' && (
                <p className="text-sm text-content-muted mt-1 font-medium">{slogan}</p>
              )}
            </div>
          </div>
        </header>`;

code = code.replace(headerRegex, newHeader);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
