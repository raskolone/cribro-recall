const fs = require('fs');
let file = fs.readFileSync('components/flashcards/FlashcardStudyScreen.tsx', 'utf8');

file = file.replace(
  `<span>{i18n.t("Umiem")}</span>\n            <span className="text-[10px] uppercase opacity-70">{i18n.t("Nie umiem (Strzałka w lewo)")}</span>`,
  `<span>{i18n.t("Nie umiem")}</span>\n            <span className="text-[10px] uppercase opacity-70">{i18n.t("Nie umiem (Strzałka w lewo)")}</span>`
);

fs.writeFileSync('components/flashcards/FlashcardStudyScreen.tsx', file);
