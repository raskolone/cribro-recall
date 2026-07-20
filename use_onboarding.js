import fs from 'fs';

let file = 'components/dashboard/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes("import OnboardingOverlay")) {
  content = content.replace(
    /import \{ useLanguage \} from '\.\.\/\.\.\/context\/LanguageContext';/,
    "import { useLanguage } from '../../context/LanguageContext';\nimport OnboardingOverlay from './OnboardingOverlay';"
  );
}

content = content.replace(
  /<div className="space-y-6 flex flex-col min-h-\[calc\(100vh-8rem\)\]">/g,
  '<div className="space-y-6 flex flex-col min-h-[calc(100vh-8rem)]">\n        {showOnboarding && <OnboardingOverlay onComplete={handleCompleteOnboarding} language={language} />}\n'
);

fs.writeFileSync(file, content);
console.log("Added OnboardingOverlay to Dashboard.tsx");
