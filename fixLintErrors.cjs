const fs = require('fs');
let code = fs.readFileSync('context/AuthContext.tsx', 'utf8');

// Fix AuthContext: make sure linkGoogleAccount is in the value object
code = code.replace(
  "updateUserStreak, connectGoogleDrive, linkGoogleAccount }>",
  "updateUserStreak, connectGoogleDrive, linkGoogleAccount }>" // Just double checking the exact string
);
if (!code.includes('linkGoogleAccount }>}')) {
    code = code.replace(
        "updateUserStreak, connectGoogleDrive }>",
        "updateUserStreak, connectGoogleDrive, linkGoogleAccount }>"
    );
}

fs.writeFileSync('context/AuthContext.tsx', code);

// Fix SettingsScreen
let settings = fs.readFileSync('components/settings/SettingsScreen.tsx', 'utf8');
const authImportSettings = "import { auth } from '../../firebase';\n";
if (!settings.includes(authImportSettings)) {
    settings = authImportSettings + settings;
}
settings = settings.replace("user?.providerData?.some", "auth.currentUser?.providerData?.some");
fs.writeFileSync('components/settings/SettingsScreen.tsx', settings);

// Fix FlashcardEditScreen (might also have providerData)
let fcEdit = fs.readFileSync('components/flashcards/FlashcardEditScreen.tsx', 'utf8');
const authImportFc = "import { auth } from '../../firebase';\n";
if (!fcEdit.includes("import { auth }")) {
    fcEdit = authImportFc + fcEdit;
}
fcEdit = fcEdit.replace("user?.providerData?.some", "auth.currentUser?.providerData?.some");
fs.writeFileSync('components/flashcards/FlashcardEditScreen.tsx', fcEdit);

// Fix geminiService
let gemini = fs.readFileSync('services/geminiService.ts', 'utf8');
gemini = gemini.replace("const textResult = response.text();", "const textResult = response.text;");
fs.writeFileSync('services/geminiService.ts', gemini);

