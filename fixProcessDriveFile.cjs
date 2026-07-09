const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

code = code.replace(
  "alert('Błąd przetwarzania pliku z dysku');",
  "alert('Błąd przetwarzania pliku: ' + (err.message || 'Nieznany błąd'));"
);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
