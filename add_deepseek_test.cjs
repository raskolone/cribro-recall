const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// We just copy the logic from gemini generate-test but use deepseek
const insertIndex = code.indexOf("app.post('/api/gemini/generate-test'");

const deepseekTestRoute = `
  app.post('/api/deepseek/generate-test', requireFirebaseAdmin, async (req, res) => {
    try {
      const { level, testTitle, scope, studentProfile, lessonContext, allLessonsContext, tasksCount, attemptsLimit, selectedTypes, typeCounts, fileData, driveFile } = req.body;
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured.' });
      
      let typeBreakdownInstruction = '';
      if (typeCounts && typeof typeCounts === 'object' && Object.keys(typeCounts).length > 0) {
        const parts = Object.entries(typeCounts)
          .filter(([t]) => !selectedTypes || selectedTypes.includes(t))
          .map(([type, count]) => \`- \${type}: DOKŁADNIE 1 ZADANIE ZBIORCZE zawierające \${count} przykładów/zdań w bullet pointach\`);
        if (parts.length > 0) {
          typeBreakdownInstruction = \`STRUKTURA ZADAŃ W TESTU (GŁÓWNA ZASADA GRUPOWANIA):\\n\${parts.join('\\n')}\\nKażdy z wybranych typów ma stanowić DOKŁADNIE JEDNO POJEDYNCZE ZADANIE ZBIORCZE z wybraną liczbą przykładów! Łączna liczba obiektów w tablicy pytań ma wynosić DOKŁADNIE \${selectedTypes ? selectedTypes.length : 1} (po jednym obiekcie dla każdego wybranego typu).\`;
        }
      }
      
      const typeRulesMap = {
        'translation': "- translation: 1 zadanie zbiorcze. W 'prompt' umieść N zdań polskich w punktach (1., 2., ...). Dodaj w nawiasie krótką wskazówkę, np. (past simple). W 'correctAnswer' umieść N angielskich tłumaczeń w punktach (1., 2., ...).",
        'fill_in_blank': "- fill_in_blank: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO TEKSTU (np. krótka historyjka). W 'prompt' umieść tekst z lukami '___'. W 'correctAnswer' umieść N poprawnych słów w punktach (1., 2., ...).",
        'fill_in_blank_bank': "- fill_in_blank_bank: 1 zadanie zbiorcze w formie JEDNEGO SPÓJNEGO TEKSTU. W 'wordBank' umieść słowa w rozsypce do wstawienia. W 'prompt' umieść tekst z lukami '___'. W 'correctAnswer' umieść N odpowiedzi.",
        'matching': "- matching: 1 zadanie zbiorcze. W 'options' zamieść listę wszystkich N par w formacie [\\"słowo1 = word1\\", \\"słowo2 = word2\\", ...].",
        'find_mistake': "- find_mistake: 1 zadanie zbiorcze. W 'prompt' umieść N zdań do poprawienia.",
        'multiple_choice': "- multiple_choice: 1 zadanie zbiorcze. W 'prompt' umieść teksty z lukami lub pytania wielokrotnego wyboru. Podaj opcje A/B/C.",
        'writing': "- writing: 1 zadanie z dłuższą wypowiedzią pisemną."
      };
      
      const activeTypes = selectedTypes || ['multiple_choice', 'fill_in_blank', 'fill_in_blank_bank', 'translation'];
      const activeRules = activeTypes.map((t) => typeRulesMap[t]).filter(Boolean).join('\\n   ');

      const prompt = \`Jesteś asystentem edukacyjnym. Tworzysz wysoce spersonalizowany test dla kursanta na poziomie \${level || 'nieokreślony'}.
      
Tytuł/Tematyka: \${testTitle || 'Brak tytułu'}
Zakres wytycznych: \${scope || 'Ogólne sprawdzenie wiedzy'}
Kontekst i hobby ucznia: \${studentProfile || 'Brak specjalnych informacji'}
Ostatnia lekcja: \${lessonContext || 'Brak'}
Wcześniejsze lekcje: \${allLessonsContext || 'Brak'}
Ogólna ilość zadań (grup): \${tasksCount || 10}

\${typeBreakdownInstruction}

ZASADY:
\${activeRules}

MUSISZ ZWRÓCIĆ WYŁĄCZNIE POPRAWNY JSON z jedną główną strukturą zawierającą tablicę 'questions'.
Struktura pojedynczego pytania (obiektu):
{
  "type": "string - jeden z: multiple_choice, fill_in_blank, fill_in_blank_bank, translation, matching, writing, find_mistake",
  "instruction": "Krótka instrukcja po polsku",
  "prompt": "Treść polecenia, tekst z lukami, wypunktowane zdania polskie itp.",
  "options": ["Opcja A", "Opcja B", ...] (tylko tam gdzie potrzebne),
  "wordBank": ["slowo1", "slowo2", ...] (tylko dla fill_in_blank_bank),
  "correctAnswer": "Prawidłowa odpowiedź (wypunktowana lista 1. ... 2. ... dla zadań wielokrotnych, konkretny klucz dla zamkniętych)",
  "points": 1
}

Zwróć format jako:
{
  "questions": [
     { "type": "...", ... }
  ]
}
\`;

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${apiKey}\`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(\`DeepSeek API error: \${response.status} - \${errorText}\`);
      }

      const data = await response.json();
      const text = data.choices[0]?.message?.content || "";
      
      const jsonBlockRegex = /\`\`\`(?:json)?\\s*([\\s\\S]*?)\\s*\`\`\`/i;
      const match = text.match(jsonBlockRegex);
      let jsonText = match && match[1] ? match[1].trim() : text;
      
      const parsed = JSON.parse(jsonText);
      res.json({ questions: parsed.questions || parsed });
    } catch (error) {
      console.error('DeepSeek generate test error:', error);
      res.status(500).json({ error: error.message || 'Error generating test' });
    }
  });
`;

code = code.slice(0, insertIndex) + deepseekTestRoute + '\n' + code.slice(insertIndex);
fs.writeFileSync('server.ts', code);
