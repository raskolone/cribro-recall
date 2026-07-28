const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldRulesPattern = /5\. Użyj TYLKO następujących typów zadań wybranych przez nauczyciela: \$\{selectedTypes \? selectedTypes\.join\(', '\) : 'multiple_choice, fill_in_blank, fill_in_blank_bank, translation'\}\.[\s\S]*?6\. WAŻNE - FORMATOWANIE I BRAK DUBLOWANIA:/;

const newRulesCode = `
      // Dynamicznie generowane zasady dla typów zadań
      const typeRulesMap: Record<string, string> = {
        'translation': "- translation: 1 zadanie zbiorcze. W 'prompt' umieść N zdań polskich w punktach (1., 2., ...). Dodaj w nawiasie krótką wskazówkę, np. (past simple), aby kursant wiedział co zastosować. W 'correctAnswer' umieść N angielskich tłumaczeń w punktach (1., 2., ...).",
        'fill_in_blank': "- fill_in_blank: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO TEKSTU (np. krótka historyjka, opowiadanie). W 'prompt' umieść tekst z lukami '___', oznaczonymi numerami lub po prostu w tekście. W 'correctAnswer' umieść N poprawnych słów w punktach (1., 2., ...).",
        'fill_in_blank_bank': "- fill_in_blank_bank: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO TEKSTU (np. krótka historyjka). W 'wordBank' umieść słowa w rozsypce do wstawienia. W 'prompt' umieść tekst z lukami '___'. W 'correctAnswer' umieść N odpowiedzi.",
        'matching': "- matching: 1 zadanie zbiorcze. W 'options' zamieść listę wszystkich N par w formacie [\\"słowo1 = word1\\", \\"słowo2 = word2\\", ...].",
        'find_mistake': "- find_mistake: 1 zadanie zbiorcze. W 'prompt' umieść N zdań/punktów do poprawienia.",
        'multiple_choice': "- multiple_choice: 1 zadanie zbiorcze. W 'prompt' umieść JEDEN SPÓJNY TEKST z lukami '___', albo N pytań wielokrotnego wyboru, w zależności od kontekstu. Jeśli to test z gramatyki np. czasowniki, to krótka historyjka jest preferowana. Podaj opcje A/B/C.",
        'writing': "- writing: 1 zadanie z dłuższą wypowiedzią pisemną."
      };
      
      const activeTypes = selectedTypes || ['multiple_choice', 'fill_in_blank', 'fill_in_blank_bank', 'translation'];
      const activeRules = activeTypes.map((t: string) => typeRulesMap[t]).filter(Boolean).join('\\n   ');

`;

content = content.replace(
    /let contents = \[\];[\s\S]*?const prompt = `Jesteś asystentem edukacyjnym/,
    newRulesCode + "      let contents = [];\n      const prompt = `Jesteś asystentem edukacyjnym"
);

content = content.replace(oldRulesPattern, `5. Użyj TYLKO następujących typów zadań wybranych przez nauczyciela: \${selectedTypes ? selectedTypes.join(', ') : 'multiple_choice, fill_in_blank, fill_in_blank_bank, translation'}.
   ZABRANIA SIĘ TWORZENIA ZADAŃ INNEGO TYPU. Jeśli dany typ nie został wymieniony na liście powyżej, NIE MOŻE pojawić się w teście!
   Zasady dla typów zadań zbiorczych:
   \${activeRules}
   
   JĘZYK I STYL ZDAŃ:
   Wszystkie wygenerowane zdania, teksty i historyjki muszą być w 100% naturalne i oparte na autentycznych materiałach, przerobionych z kursantem.
   Unikaj "pokręconych", sztucznych i fikcyjnych konstrukcji. Pisz tak, jak rozmawiają ludzie. Zastosuj się ściśle do przesłanego kontekstu lekcji.
   
6. WAŻNE - FORMATOWANIE I BRAK DUBLOWANIA:`);

fs.writeFileSync('server.ts', content);
