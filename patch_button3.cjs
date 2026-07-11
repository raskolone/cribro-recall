const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const oldAnims = `{isLoading && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 bg-primary/20"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 15, ease: "circOut" }} 
        />
      )}
      {isLoading && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-primary/10"
        />
      )}`;

const newAnims = `{isLoading && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 bg-black/10"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 15, ease: "circOut" }} 
        />
      )}
      {isLoading && (
        <motion.div
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-black/20"
        />
      )}`;

code = code.replace(oldAnims, newAnims);
fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
