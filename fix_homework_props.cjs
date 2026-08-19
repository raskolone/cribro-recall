const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeworkScreen.tsx', 'utf8');

const oldInterface = `interface HomeworkScreenProps {
  initialTaskId?: string | null;
  onBack?: () => void;
}`;

const newInterface = `interface HomeworkScreenProps {
  initialTaskId?: string | null;
  initialStudentId?: string | null;
  onBack?: () => void;
}`;

if (content.includes(oldInterface)) {
  content = content.replace(oldInterface, newInterface);
  
  // Now add it to the component props
  content = content.replace(
    `const HomeworkScreen: React.FC<HomeworkScreenProps> = ({ initialTaskId = null, onBack }) => {`,
    `const HomeworkScreen: React.FC<HomeworkScreenProps> = ({ initialTaskId = null, initialStudentId = null, onBack }) => {`
  );

  // Initialize selectedStudentId
  content = content.replace(
    `const [selectedStudentId, setSelectedStudentId] = useState<string>('');`,
    `const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');`
  );
  
  // also add useEffect to sync it if it changes
  const useEffectBlock = `
  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      setActiveTab('create');
    }
  }, [initialStudentId]);
`;
  content = content.replace(`const [homeworkType, setHomeworkType]`, useEffectBlock + `  const [homeworkType, setHomeworkType]`);

  fs.writeFileSync('components/dashboard/HomeworkScreen.tsx', content);
  console.log('HomeworkScreen updated with initialStudentId');
}
