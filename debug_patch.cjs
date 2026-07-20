const fs = require('fs');
const path = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// We will replace `const [error, setError] = useState<string | null>(null);`
// with `const [error, setError] = useState<string | null>(null); const [debugStr, setDebugStr] = useState<string>('');`
// and then add `setDebugStr(prev => prev + '\n' + msg);`
// But an easier way is to just add it.

let newContent = content.replace(
  `const [error, setError] = useState<string | null>(null);`,
  `const [error, setError] = useState<string | null>(null);\n  const [debugLogs, setDebugLogs] = useState<string>('');\n  const addLog = (msg: string) => { console.log(msg); setDebugLogs(prev => prev + "\\n" + msg); };`
);

// Now in handleGenerate
newContent = newContent.replace(
  `const handleGenerate = async (isAppending = false) => {`,
  `const handleGenerate = async (isAppending = false) => {\n    addLog('Starting handleGenerate');`
);

newContent = newContent.replace(
  `await Promise.all(fetchPromises);`,
  `addLog('Waiting for fetchPromises');\n      await Promise.all(fetchPromises);\n      addLog('fetchPromises resolved');`
);

newContent = newContent.replace(
  `const generated = await generateTranslationExercises(`,
  `addLog('Calling generateTranslationExercises');\n      const generated = await generateTranslationExercises(`
);

newContent = newContent.replace(
  `if (generated && generated.length > 0) {`,
  `addLog('generateTranslationExercises returned ' + (generated ? generated.length : 'null'));\n      if (generated && generated.length > 0) {`
);

// Display the debug logs in UI
newContent = newContent.replace(
  `{error && (`,
  `{debugLogs && <div className="text-xs font-mono text-white/50 whitespace-pre-wrap mb-4 bg-black/40 p-4 rounded-xl">{debugLogs}</div>}\n      {error && (`
);

fs.writeFileSync(path, newContent);
console.log('Patched with debug logs');
