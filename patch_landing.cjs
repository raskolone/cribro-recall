const fs = require('fs');
let content = fs.readFileSync('components/landing/LandingPage.tsx', 'utf8');

// Replace the typewriter import
content = content.replace("import { Typewriter } from 'react-simple-typewriter';", "");

// Create a small custom Typewriter component and inject it
const customTypewriter = `
const Typewriter = ({ words, loop }: { words: string[], loop: boolean }) => {
  const [currentWord, setCurrentWord] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const word = words[wordIndex];
    let timeout: NodeJS.Timeout;
    
    if (isDeleting) {
      if (currentWord === '') {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
        timeout = setTimeout(() => {}, 500);
      } else {
        timeout = setTimeout(() => {
          setCurrentWord(word.substring(0, currentWord.length - 1));
        }, 50);
      }
    } else {
      if (currentWord === word) {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      } else {
        timeout = setTimeout(() => {
          setCurrentWord(word.substring(0, currentWord.length + 1));
        }, 100);
      }
    }
    return () => clearTimeout(timeout);
  }, [currentWord, isDeleting, wordIndex, words]);

  return <span>{currentWord}<span className="animate-pulse">|</span></span>;
};
`;

content = content.replace("const MockupWindow = ", customTypewriter + "\n\nconst MockupWindow = ");

fs.writeFileSync('components/landing/LandingPage.tsx', content);
console.log("Patched LandingPage");
