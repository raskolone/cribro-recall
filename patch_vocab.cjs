const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

code = code.replace(
  /{activeTab === 'vocabulary' && 'Wybierz kursanta \\(Słownictwo\\)'}/g,
  "{activeTab === 'vocabulary' && 'Wybierz kursanta (Słownictwo i zadania)'}"
);
code = code.replace(
  /{ id: 'vocabulary', label: 'Słownictwo' }/g,
  "{ id: 'vocabulary', label: 'Słownictwo i zadania' }"
);
code = code.replace(
  /{activeTab === 'vocabulary' && 'Słownictwo'}/g,
  "{activeTab === 'vocabulary' && 'Słownictwo i zadania'}"
);
code = code.replace(
  /<h3 className="text-xl font-bold">Zestawy Słówek Kursanta<\/h3>/g,
  '<h3 className="text-xl font-bold">Zestawy słówek i zadania specjalne</h3>'
);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('patched');
