const fs = require('fs');
let code = fs.readFileSync('components/flashcards/FlashcardEditScreen.tsx', 'utf8');

code = code.replace(
  "const fetchDriveFiles = async () => {",
  `const fetchDriveFiles = async () => {
    if (!user?.providerData?.some(p => p.providerId === 'google.com')) {
      alert(language === 'pl' ? 'Musisz najpierw powiązać swoje konto z Google w Ustawieniach.' : 'You must link your account with Google in Settings first.');
      return;
    }
`
);

fs.writeFileSync('components/flashcards/FlashcardEditScreen.tsx', code);
