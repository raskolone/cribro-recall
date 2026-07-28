const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const summaryFunctions = `

export const generateLessonSummary = async (notes: string, pdfBase64: string, studentsListStr: string): Promise<any> => {
  let promptContext: any[] = [];
  if (pdfBase64) {
    promptContext = [{
      role: 'user',
      parts: [
        {
          inlineData: {
            data: pdfBase64.split(',')[1] || pdfBase64,
            mimeType: 'application/pdf'
          }
        },
        { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nPowyżej znajduje się plik PDF z notatkami z lekcji. Przeanalizuj go.\` }
      ]
    }];
  } else {
    promptContext = [{
      role: 'user',
      parts: [{ text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTranskrypcja/Notatki ze spotkania:\\n\${notes}\` }]
    }];
  }

  const sysInstruction = \`# Cel
Na podstawie AI meeting notes przygotuj podsumowanie lekcji języka angielskiego dla kursanta.
Źródłem danych jest gotowe podsumowanie spotkania. Jeśli gotowe podsumowanie jest niewystarczające, użyj pełnej transkrypcji.
Ta wersja promptu służy do uzupełniania pól w aplikacji Cribro. Każda sekcja ma odpowiadać jednemu polu w aplikacji.
Nie generuj pracy domowej, zdań do tłumaczenia, ćwiczeń z lukami ani zadań spaced repetition.
Wszystkie pola opisowe (revisionNotes, studentSpeaking, thingsToImprove, suggestedFollowUp) wygeneruj w języku polskim. Słownictwo naturalnie ma być w dwóch językach (słowo angielskie - polskie tłumaczenie).
Jeśli w materiale brakuje danych do danej sekcji, wpisz po polsku:
Brak danych w transkrypcji.

# Zanim wygenerujesz
Zidentyfikuj kursanta, którego dotyczy lekcja na podstawie podanej bazy kursantów i dopasuj studentId. Dostosuj poziom języka i szczegółowość treści do profilu wybranego kursanta.

# Wygeneruj wynik w formacie JSON
Zwróć wynik jako JSON z poniższymi polami:
- studentId (string, ID wybranego kursanta z Bazy Kursantów, jeśli nie potrafisz dopasować zostaw puste)
- lessonTopic (string, Krótkie, jednozdaniowe podsumowanie tematu lekcji na podstawie revision notes. Maksymalnie 50 znaków, bez daty, zwięzłe hasło bez wieloczęściowych zdań.)
- revisionNotes (string, Krótkie podsumowanie lekcji w stronie biernej po polsku, 3-6 zdań)
- vocabularyText (string, Słownictwo i wymowa z lekcji. Zasada formatowania: każde słowo i jego definicja (lub wymowa) mają być w osobnej linijce, oddzielone myślnikiem. Np. "word - tłumaczenie" i w następnej linii kolejne słowo)
- studentSpeaking (string, Krótkie memory o kursancie po polsku, 5-6 zdań neutralnie o czym mówił, styl itp.)
- thingsToImprove (string, 2-3 obszary wymagające poprawy z diagnozą i przykładami, po polsku)
- suggestedFollowUp (string, Ustalenia i najlepsze tematy na kolejną lekcję, po polsku)
\`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      studentId: { type: Type.STRING },
      lessonTopic: { type: Type.STRING },
      revisionNotes: { type: Type.STRING },
      vocabularyText: { type: Type.STRING },
      studentSpeaking: { type: Type.STRING },
      thingsToImprove: { type: Type.STRING },
      suggestedFollowUp: { type: Type.STRING },
    },
    required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText", "studentSpeaking", "thingsToImprove", "suggestedFollowUp"]
  };

  const response = await generateContentWithFallback({ 
    contents: promptContext, 
    config: {
      systemInstruction: sysInstruction,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const text = response?.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(extractJSON(text));
};

export const generateBulkLessonSummary = async (notes: string, pdfBase64: string, studentsListStr: string): Promise<any> => {
  let contents: any[] = [];
  if (pdfBase64) {
    contents = [{
      role: 'user',
      parts: [
        {
          inlineData: {
            data: pdfBase64.split(',')[1] || pdfBase64,
            mimeType: 'application/pdf'
          }
        },
        { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nPowyżej znajduje się plik PDF z historią lekcji. Przeanalizuj go.\` }
      ]
    }];
  } else {
    contents = [{
      role: 'user',
      parts: [
        { text: \`Baza kursantów:\\n\${studentsListStr}\\n\\nTreść historii lekcji (Google Docs / Text):\\n\${notes}\` }
      ]
    }];
  }

  const sysInstruction = \`# Cel
Na podstawie dostarczonego pliku PDF lub tekstu zawierającego historię lekcji jednego lub wielu kursantów, DOKŁADNIE wyodrębnij wszystkie poszczególne lekcje.
Plik może zawierać wiele lekcji ułożonych chronologicznie lub według numerów. Twoim zadaniem jest znalezienie KAŻDEJ lekcji i wyciągnięcie z niej maksimum informacji.

# Zanim wygenerujesz
1. Zidentyfikuj kursanta (studentId) dla KAŻDEJ lekcji na podstawie podanej bazy kursantów (imienia, nazwiska lub opisu widocznego w pliku). 
2. Podziel dokument na logiczne bloki odpowiadające pojedynczym lekcjom.
3. Przeanalizuj inteligentnie każdą lekcję i przypisz jej fragmenty do odpowiednich kategorii w systemie.

# Wygeneruj wynik w formacie JSON
Zwróć wynik jako JSON z tablicą obiektów o polu "lessons". Każdy obiekt lekcji musi zawierać szczegółowe dane:
- date (string): Data lekcji w formacie YYYY-MM-DD. Poszukaj daty w tekście (np. "12 marca", "12.03.2024"). Jeśli absolutnie brak, wygeneruj dzisiejszą.
- studentId (string): ID wybranego kursanta dopasowanego z bazy.
- lessonTopic (string): Krótki temat lekcji (max 50 znaków), wywnioskowany z treści.
- revisionNotes (string): Główne notatki, zagadnienia gramatyczne i tematy poruszane na lekcji.
- vocabularyText (string): Wyodrębnione nowe słówka, zwroty i ich tłumaczenia (najlepiej w formie 'angielski - polski').
- studentSpeaking (string): O czym mówił kursant, jakich argumentów używał, jego opinie (np. 'Mówił o swoich wakacjach w Hiszpanii...').
- thingsToImprove (string): Błędy gramatyczne, wymowa, rzeczy do poprawy na przyszłość.
- suggestedFollowUp (string): Zadanie domowe, sugestie co zrobić na następnej lekcji.

Bądź dokładny. Wykorzystaj całą dostępną treść, nie pomijaj lekcji.\`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      lessons: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            studentId: { type: Type.STRING },
            lessonTopic: { type: Type.STRING },
            revisionNotes: { type: Type.STRING },
            vocabularyText: { type: Type.STRING },
            studentSpeaking: { type: Type.STRING },
            thingsToImprove: { type: Type.STRING },
            suggestedFollowUp: { type: Type.STRING },
          },
          required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText"]
        }
      }
    },
    required: ["lessons"]
  };
  
  const response = await generateContentWithFallback({ 
    contents: contents, 
    config: {
      systemInstruction: sysInstruction,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const responseText = response?.text;
  if (!responseText) throw new Error("No response from Gemini");
  return JSON.parse(extractJSON(responseText));
};

`;

code = code + '\n' + summaryFunctions;

fs.writeFileSync('services/geminiService.ts', code);
console.log("Patched geminiService with summary endpoints");
