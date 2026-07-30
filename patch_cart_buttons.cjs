const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf-8');

const target = `            <div className="flex items-center gap-4 bg-primary/10 px-4 py-2 rounded-full">
              <span className="text-sm font-bold text-primary">{cart.length} słówek w koszyku</span>
              <Button size="sm" onClick={() => {
                alert('Opcje dla koszyka (np. utwórz ćwiczenie, wygeneruj test) pojawią się tutaj.');
              }}>Wykorzystaj słówka</Button>
            </div>`;

const replacement = `            <div className="flex items-center gap-4 bg-primary/10 px-4 py-2 rounded-full">
              <span className="text-sm font-bold text-primary">{cart.length} słówek w koszyku</span>
              <div className="flex gap-2">
                 <Button size="sm" variant="secondary" onClick={() => {
                   if(confirm('Na pewno wyczyścić koszyk?')) setCart([]);
                 }}>Wyczyść</Button>
                 <Button size="sm" onClick={() => {
                   const wordsStr = cart.map(w => \`- \${w.english} (\${w.polish})\`).join('\\n');
                   alert(\`Skopiowano do schowka:\\n\${wordsStr}\`);
                   navigator.clipboard.writeText(wordsStr);
                 }}>Skopiuj do wykorzystania</Button>
              </div>
            </div>`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
    console.log("Patched TopicDatabaseScreen.tsx (Cart Buttons)");
} else {
    console.log("Target not found");
}
