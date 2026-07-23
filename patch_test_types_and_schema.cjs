const fs = require('fs');

// 1. types.ts
let typesContent = fs.readFileSync('types.ts', 'utf8');
typesContent = typesContent.replace(
  /prompt: string; \/\/ The question or sentence to translate/,
  'instruction?: string;\n  prompt: string; // The question or sentence to translate'
);
fs.writeFileSync('types.ts', typesContent);

// 2. server.ts
let serverContent = fs.readFileSync('server.ts', 'utf8');

// Update schema
serverContent = serverContent.replace(
  /type: { type: Type.STRING, enum: \["multiple_choice", "fill_in_blank", "translation", "matching", "writing", "find_mistake"\], description: "Type of the question" },/,
  'type: { type: Type.STRING, enum: ["multiple_choice", "fill_in_blank", "translation", "matching", "writing", "find_mistake"], description: "Type of the question" },\n            instruction: { type: Type.STRING, description: "Clear instruction in Polish, e.g. \\"Uzupełnij luki:\\"" },'
);

// Update prompt rules
serverContent = serverContent.replace(
  /5\. Użyj TYLKO następujących typów zadań wybranych przez nauczyciela:[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n6\. WAŻNE: W polu "prompt" KAŻDEGO zadania ZAWSZE zamieść wyraźne polecenie dla kursanta \([^)]+\)\.\n7\. Jeśli jednym z wybranych typów jest "writing", upewnij się, że jedno z zadań ma type "writing" i wymaga napisania dłuższego tekstu opartego na zagadnieniach z wybranych lekcji\./g,
  `5. Użyj TYLKO następujących typów zadań wybranych przez nauczyciela: \${selectedTypes ? selectedTypes.join(', ') : 'multiple_choice, fill_in_blank, translation'}.
   ZABRANIA SIĘ TWORZENIA ZADAŃ INNEGO TYPU. Jeśli na liście nie ma 'writing', kategorycznie nie twórz zadań 'writing'.
   Dozwolone typy: 
   - multiple_choice (wielokrotnego wyboru),
   - fill_in_blank (wpisywanie brakujących elementów),
   - translation (tłumaczenie z polskiego na angielski),
   - matching (łączenie w pary - w opcjach podaj pary do złączenia oddzielone znakiem =, a w correctAnswer napisz np. 'połączone'),
   - writing (zadanie polegające na dłuższej wypowiedzi pisemnej na podstawie zagadnień, bez correctAnswer, uczeń pisze własny tekst).
   - find_mistake (znalezienie błędu w zdaniu. W polu options wygeneruj 4 wersje zdania, tylko JEDNA jest w 100% poprawna, w correctAnswer - dokładna poprawna wersja).
6. WAŻNE: W polu "instruction" KAŻDEGO zadania ZAWSZE zamieść wyraźne polecenie w języku polskim (np. "Wybierz prawidłową opcję:", "Uzupełnij luki w zdaniu:"). W polu "prompt" umieść właściwe zadanie (np. zdanie z luką, zdanie do przetłumaczenia).
7. Jeśli jednym z wybranych typów jest "writing", upewnij się, że jedno z zadań to "writing". Jeśli nie - kategorycznie nie.`
);

fs.writeFileSync('server.ts', serverContent);

