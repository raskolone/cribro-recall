const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const oldButton = `const AILoadingButton = ({ isLoading, onClick, children, className, disabled, loadingText, variant = 'primary' }: any) => {
  const baseStyles = 'relative overflow-hidden inline-flex items-center justify-center font-bold font-sans rounded focus:outline-none transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed';
  
  // Custom styling for loading vs default state
  const isPrimary = variant === 'primary';
  const defaultStyles = isPrimary
    ? 'bg-primary text-base-100 hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_0_20px_rgba(114,240,180,0.4)]'
    : 'bg-transparent border-[1.5px] border-white/20 text-content hover:border-primary/60 hover:text-primary hover:bg-primary/10 hover:-translate-y-[1px]';
    
  const loadingStyles = 'bg-primary/20 text-primary cursor-wait border border-primary/50 shadow-[0_0_15px_rgba(114,240,180,0.2)]';`;

const newButton = `const AILoadingButton = ({ isLoading, onClick, children, className, disabled, loadingText, variant = 'primary' }: any) => {
  const baseStyles = 'relative overflow-hidden inline-flex items-center justify-center font-bold font-sans rounded focus:outline-none transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed';
  
  // Custom styling for loading vs default state
  const isPrimary = variant === 'primary';
  const defaultStyles = isPrimary
    ? 'bg-primary text-base-100 hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_0_20px_rgba(114,240,180,0.4)]'
    : 'bg-transparent border-[1.5px] border-white/20 text-content hover:border-primary/60 hover:text-primary hover:bg-primary/10 hover:-translate-y-[1px]';
    
  const loadingStyles = 'bg-[#00FF66] text-black cursor-wait shadow-[0_0_30px_rgba(0,255,102,0.8)] animate-[pulse_1s_ease-in-out_infinite] scale-[1.02]';`;

code = code.replace(oldButton, newButton);

const oldText1 = `loadingText={language === 'pl' ? 'Generowanie zadań...' : 'Generating exercises...'}`;
const newText1 = `loadingText={language === 'pl' ? 'Ładowanie ćwiczenia...' : 'Loading exercise...'}`;

code = code.split(oldText1).join(newText1);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
