const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf-8');

const target1 = `  const [vocabularySets, setVocabularySets] = useState<any[]>([]);`;
const replacement1 = `  const [vocabularySets, setVocabularySets] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);`;

const target2 = `                       <div key={idx} className="flex gap-2 text-sm">
                         <span className="font-bold text-primary w-1/3">{w.english}</span>
                         <span className="text-content-muted w-2/3">{w.polish}</span>
                       </div>`;

const replacement2 = `                       <div key={idx} className="flex items-center gap-2 text-sm">
                         <input 
                           type="checkbox" 
                           className="checkbox checkbox-xs" 
                           checked={cart.some(item => item.id === w.id)} 
                           onChange={(e) => {
                             if(e.target.checked) setCart(prev => [...prev, w]);
                             else setCart(prev => prev.filter(item => item.id !== w.id));
                           }} 
                         />
                         <span className="font-bold text-primary w-1/3">{w.english}</span>
                         <span className="text-content-muted w-2/3">{w.polish}</span>
                       </div>`;

const target3 = `        <h2 className="text-xl font-bold mt-8 mb-4">{i18n.t("Baza Słownictwa")}</h2>`;
const replacement3 = `        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-xl font-bold">{i18n.t("Baza Słownictwa")}</h2>
          {cart.length > 0 && (
            <div className="flex items-center gap-4 bg-primary/10 px-4 py-2 rounded-full">
              <span className="text-sm font-bold text-primary">{cart.length} słówek w koszyku</span>
              <Button size="sm" onClick={() => {
                alert('Opcje dla koszyka (np. utwórz ćwiczenie, wygeneruj test) pojawią się tutaj.');
              }}>Wykorzystaj słówka</Button>
            </div>
          )}
        </div>`;

if (code.includes(target1) && code.includes(target2) && code.includes(target3)) {
    code = code.replace(target1, replacement1);
    code = code.replace(target2, replacement2);
    code = code.replace(target3, replacement3);
    fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
    console.log("Patched TopicDatabaseScreen.tsx (Cart added)");
} else {
    console.log("Target not found");
}
