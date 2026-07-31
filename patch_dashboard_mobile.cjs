const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const targetImport = `import { ChevronDown, Sparkles } from 'lucide-react';`;
const newImport = `import { ChevronDown, Sparkles, Menu } from 'lucide-react';`;
code = code.replace(targetImport, newImport);

const targetSloganInterval = `const interval = setInterval(animateSlogan, 5000); // Change slogan every 5 seconds`;
const newSloganInterval = `const interval = setInterval(animateSlogan, 15000); // Change slogan every 15 seconds`;
code = code.replace(targetSloganInterval, newSloganInterval);

const targetHeader = `<header className="p-4 bg-base-100 border-b border-white/10 flex justify-between items-center">
          <div ref={sloganContainerRef} className="text-primary font-bold">
            {slogan}
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2">Menu</button>
        </header>`;
const newHeader = `<header className="p-4 bg-base-100 border-b border-white/10 flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-content-muted hover:text-white transition-colors">
            <Menu size={24} />
          </button>
          <div ref={sloganContainerRef} className="text-primary font-bold flex-1 text-center md:text-left">
            {slogan}
          </div>
        </header>`;
code = code.replace(targetHeader, newHeader);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
