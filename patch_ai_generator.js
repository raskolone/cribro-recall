import fs from 'fs';
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const userDeclarationTarget = `  const { user } = useAuth();`;
const userDeclarationReplacement = `  const { user } = useAuth();\n  const isTeacher = user?.role === 'admin' || user?.role === 'admin_student';`;

content = content.replace(userDeclarationTarget, userDeclarationReplacement);

const buttonTarget = `          {true && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4" />
              {language === 'pl' ? 'Konfiguracja Promptu' : 'Prompt Setup'}
            </Button>
          )}`;
const buttonReplacement = `          {isTeacher && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4" />
              {language === 'pl' ? 'Konfiguracja Promptu' : 'Prompt Setup'}
            </Button>
          )}`;

content = content.replace(buttonTarget, buttonReplacement);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
