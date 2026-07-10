const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `      const sysInstruction = \`# Cel
Na podstawie dostarczonego pliku lub tekstu zawierającego historię lekcji jednego lub wielu kursantów, wyodrębnij wszystkie poszczególne lekcje.
Jeśli lekcje są podzielone na numery lekcji z odpowiednimi sekcjami, uzupełnij je na tej podstawie.
Dostosuj do dostępnych możliwości, pomijając nadmiarowe dane lub braki.

# Zanim wygenerujesz
Zidentyfikuj kursanta (studentId) dla KAŻDEJ lekcji na podstawie podanej bazy kursantów. 
Każda lekcja musi mieć swój osobny wpis.

# Wygeneruj wynik w formacie JSON
Zwróć wynik jako JSON z tablicą obiektów o polu "lessons". Każdy obiekt lekcji musi zawierać:
- date (string, data lekcji w formacie YYYY-MM-DD. Jeśli brak, wygeneruj orientacyjną (np dzisiejszą) lub zostaw puste)
- studentId (string, ID wybranego kursanta)
- lessonTopic (string, max 50 znaków)
- revisionNotes (string)
- vocabularyText (string)
- studentSpeaking (string)
- thingsToImprove (string)
- suggestedFollowUp (string)\`;`;

const replacement = `      const sysInstruction = \`# Cel
Na podstawie załączonego pliku (PDF lub dokumentu z Google Drive) wyciągnij z każdego podsumowania lekcji odpowiednie informacje i dopasuj je do zdefiniowanych poniżej pól w aplikacji.

# Zasady wyciągania informacji:
1. Zignoruj pola i informacje z pliku, które nie odpowiadają żadnemu z naszych zdefiniowanych pól.
2. Najważniejsze informacje do wyciągnięcia: temat lekcji, data lekcji, notatki (revision notes), słownictwo (vocabulary), o czym mówił kursant (student speaking), rzeczy do poprawy (things to improve) oraz sugestie do dalszego działania (suggested follow up).
3. Jeżeli w notatkach z lekcji brakuje którejś z dodatkowych sekcji (np. brakuje "o czym mówił kursant" lub "sugestie do dalszego działania"), po prostu zostaw to pole puste i idź dalej. Nie wymyślaj danych.
4. Zidentyfikuj kursanta (studentId) dla KAŻDEJ lekcji na podstawie podanej bazy kursantów. Jeśli dokument dotyczy jednego kursanta, każda wyciągnięta lekcja musi mieć jego ID.
5. Zwróć dane dla wszystkich wyodrębnionych lekcji, jako JSON z tablicą obiektów w polu "lessons".

# Definicje pól dla każdej lekcji:
- date: Data lekcji w formacie YYYY-MM-DD. Jeśli brak, zostaw puste.
- studentId: ID zidentyfikowanego kursanta.
- lessonTopic: Temat lekcji.
- revisionNotes: Podsumowanie lekcji / Revision notes.
- vocabularyText: Jakie było słownictwo.
- studentSpeaking: O czym mówił kursant (zostaw puste, jeśli brak).
- thingsToImprove: Najważniejsze rzeczy do poprawy (zostaw puste, jeśli brak).
- suggestedFollowUp: Sugestie do dalszego działania na kolejne lekcje (zostaw puste, jeśli brak).\`;`;

code = code.replace(target, replacement);

const targetRequired = `                  required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText", "studentSpeaking", "thingsToImprove", "suggestedFollowUp"]`;
const replacementRequired = `                  required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText"]`;

code = code.replace(targetRequired, replacementRequired);

fs.writeFileSync('server.ts', code);
