const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

// First, inject `words` into useVocabulary call
if (code.includes("const { difficultWords, dueWords,")) {
  code = code.replace(
    "const { difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();",
    "const { words, difficultWords, dueWords, frequency, lastPractice, lastRevisionDate } = useVocabulary();"
  );
}

const newSloganLogic = `
    let slogans: string[] = [];
    const easyWordsCount = (words && difficultWords) ? words.length - difficultWords.length : 0;
    const dueCount = dueWords ? dueWords.length : 0;

    if (language === 'pl') {
       if (user?.streakCount && user.streakCount > 2) {
          slogans = [
            'Niesamowita passa! Masz już ' + user.streakCount + ' dni z rzędu. Oby tak dalej!',
            'Twój płomień płonie! ' + user.streakCount + ' dni nauki z rzędu. Lecimy dalej?',
            'Znakomita regularność! Co dzisiaj szlifujemy?'
          ];
       } else if (easyWordsCount > 10) {
          slogans = [
            'Świetna robota! Opanowałeś już ' + easyWordsCount + ' słówek. Działaj dalej!',
            'Twoja wiedza rośnie, masz już ' + easyWordsCount + ' znanych słów!',
            'Udało Ci się już opanować ' + easyWordsCount + ' słówek! Co dzisiaj poćwiczymy?'
          ];
       } else if (dueCount > 0) {
          slogans = [
            'Czas na powtórkę! Masz ' + dueCount + ' słówek do przejrzenia.',
            'Nie traćmy czasu, czeka na Ciebie ' + dueCount + ' słówek w powtórkach.',
            'Systematyczność to klucz, masz dzisiaj ' + dueCount + ' słów do przypomnienia.'
          ];
       } else if (user?.loginCount && user.loginCount > 10) {
          slogans = [
            'Jesteś tu już stałym bywalcem! Gotowy na kolejne wyzwanie?',
            'Świetnie Ci idzie, nie zwalniaj tempa!',
            'Gotowy pobić swoje kolejne rekordy?'
          ];
       } else {
          slogans = [
            'Co dzisiaj poćwiczymy?',
            'Kolejny dzień, kolejna szansa na nową wiedzę!',
            'Pamiętaj, że małe kroki prowadzą do wielkich sukcesów!',
            'Masz chwilę? Zróbmy szybką powtórkę.'
          ];
       }
    } else {
       if (user?.streakCount && user.streakCount > 2) {
          slogans = [
            'Amazing streak! ' + user.streakCount + ' days in a row. Keep it up!',
            'Your flame is burning! ' + user.streakCount + ' days of learning. Ready for more?',
            'Great consistency! What are we practicing today?'
          ];
       } else if (easyWordsCount > 10) {
          slogans = [
            'Great job! You\\'ve mastered ' + easyWordsCount + ' words. Keep going!',
            'Your vocabulary is growing, you know ' + easyWordsCount + ' words now!',
            'You\\'ve successfully learned ' + easyWordsCount + ' words! What\\'s next?'
          ];
       } else if (dueCount > 0) {
          slogans = [
            'Time for a review! You have ' + dueCount + ' words waiting.',
            'Let\\'s not waste time, ' + dueCount + ' words need your attention.',
            'Consistency is key, you have ' + dueCount + ' words to review today.'
          ];
       } else if (user?.loginCount && user.loginCount > 10) {
          slogans = [
            'You are a regular here! Ready for another challenge?',
            'You\\'re doing great, keep up the pace!',
            'Ready to beat your own records?'
          ];
       } else {
          slogans = [
            'What are we practicing today?',
            'Another day, another chance to learn something new!',
            'Remember, small steps lead to big success!',
            'Got a minute? Let\\'s do a quick review.'
          ];
       }
    }
    setSlogan(slogans[Math.floor(Math.random() * slogans.length)]);
`;

// Replace the old slogan logic
const oldSloganRegex = /let slogans: string\[\] = \[\];[\s\S]*?setSlogan\(slogans\[Math\.floor\(Math\.random\(\) \* slogans\.length\)\]\);/;
if (code.match(oldSloganRegex)) {
  code = code.replace(oldSloganRegex, newSloganLogic);
}

// Ensure the dependencies of useEffect contain the new variables
code = code.replace(
  "  }, [user?.firstName, language, user?.streakCount, user?.loginCount]);",
  "  }, [user?.firstName, language, user?.streakCount, user?.loginCount, words, difficultWords, dueWords]);"
);

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
