import fs from 'fs';

let file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');

const replacement = `const AILoadingButton = ({ isLoading, onClick, children, className, disabled, loadingText, variant = 'primary' }: any) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={\`relative overflow-hidden \${className} \${
        variant === 'primary' 
          ? 'bg-primary text-black hover:bg-primary/95' 
          : 'bg-base-200 text-white hover:bg-base-300 border border-white/10'
      } rounded-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed\`}
    >
      {isLoading && (
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "circOut" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-1/2 -skew-x-12"
        />
      )}
      {isLoading && (
        <motion.div
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-black/20"
        />
      )}
      <div className="relative z-10 flex items-center justify-center gap-2">
        {isLoading && <Sparkles className="w-5 h-5 animate-spin" />}
        {isLoading ? loadingText : children}
      </div>
    </button>
  );
};

const AIExerciseGeneratorScreen: React.FC`;

content = content.replace(/const AIExerciseGeneratorScreen: React\.FC/, replacement);
fs.writeFileSync(file, content);
console.log("Added AILoadingButton");
