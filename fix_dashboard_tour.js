import fs from 'fs';

let file = 'components/dashboard/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Add import
content = content.replace(
  /import AIExerciseGeneratorScreen from '.\/AIExerciseGeneratorScreen';/,
  "import AIExerciseGeneratorScreen from './AIExerciseGeneratorScreen';\nimport { OnboardingTour } from './OnboardingTour';"
);

// Add update doc imports
if (!content.includes("doc, updateDoc")) {
  content = content.replace(
    /import \{ auth \} from '\.\.\/\.\.\/firebase';/,
    "import { auth, db } from '../../firebase';\nimport { doc, updateDoc } from 'firebase/firestore';"
  );
}

// State
content = content.replace(
  /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/,
  "const [isSidebarOpen, setIsSidebarOpen] = useState(false);\n  const [showOnboarding, setShowOnboarding] = useState(false);\n  \n  useEffect(() => {\n    if (user && !user.onboardingCompleted) {\n      setShowOnboarding(true);\n    }\n  }, [user?.onboardingCompleted]);\n  \n  const handleCompleteOnboarding = async () => {\n    setShowOnboarding(false);\n    if (user?.id) {\n      try {\n        await updateDoc(doc(db, 'users', user.id), { onboardingCompleted: true });\n      } catch(e) { console.error(e); }\n    }\n  };\n"
);

// Add to render
content = content.replace(
  /<\/div>\s*<\/div>\s*\);\s*\};\s*export default Dashboard;/,
  "    </div>\n      {showOnboarding && <OnboardingTour onComplete={handleCompleteOnboarding} />}\n    </div>\n  );\n};\n\nexport default Dashboard;"
);

fs.writeFileSync(file, content);
console.log("Updated Dashboard with Tour");
