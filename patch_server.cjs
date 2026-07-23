const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /enum: \["multiple_choice", "fill_in_blank", "translation", "matching", "writing"\]/,
  'enum: ["multiple_choice", "fill_in_blank", "translation", "matching", "writing", "find_mistake"]'
);
content = content.replace(
  /- writing \(zadanie polegające na dłuższej wypowiedzi pisemnej na podstawie zagadnień, bez correctAnswer, uczeń pisze własny tekst\)\./,
  '- writing (zadanie polegające na dłuższej wypowiedzi pisemnej na podstawie zagadnień, bez correctAnswer, uczeń pisze własny tekst).\n   - find_mistake (znalezienie błędu w zdaniu. W polu options wygeneruj dokładnie 4 wersje tego samego zdania, z czego TYLKO JEDNA jest całkowicie poprawna pod względem gramatycznym i leksykalnym, a w polu correctAnswer podaj DOKŁADNIE tekst tej jednej poprawnej wersji).'
);

fs.writeFileSync(file, content);
