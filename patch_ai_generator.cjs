const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

const imports = `import { Volume2, Loader2 } from 'lucide-react';
const ACCENTS = ['en-US', 'en-GB', 'en-AU', 'en-SCT'];
const ACCENT_FLAGS: Record<string, string> = {
  'en-US': '🇺🇸',
  'en-GB': '🇬🇧',
  'en-AU': '🇦🇺',
  'en-SCT': '🏴󠁧󠁢󠁳󠁣󠁴󠁿'
};
`;

code = code.replace(/import \{ \w+(, \w+)* \} from 'lucide-react';/, match => {
   if (!match.includes('Volume2')) match = match.replace('}', ', Volume2 }');
   if (!match.includes('Loader2')) match = match.replace('}', ', Loader2 }');
   return match;
});

if (!code.includes('const ACCENTS')) {
   code = code.replace(/const DEFAULT_GENERATION_PROMPT/, imports + '\nconst DEFAULT_GENERATION_PROMPT');
}

const stateVars = `
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  const handlePlaySentenceAudio = async (text: string, lang: string, index: number) => {
    if (playingAudioIndex === index) return;
    setPlayingAudioIndex(index);
    try {
      const res = await fetch(\`/api/tts?text=\${encodeURIComponent(text)}&lang=\${lang}\`);
      if (!res.ok) throw new Error('Audio failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingAudioIndex(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      console.error(err);
      setPlayingAudioIndex(null);
    }
  };
`;

if (!code.includes('playingAudioIndex')) {
  code = code.replace(/const \[isConfigOpen, setIsConfigOpen\] = useState<boolean>\(false\);/, "const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);" + stateVars);
}

const buttonHTML = `
                        <div className="text-xs text-content-muted font-bold mb-1 uppercase tracking-wider flex items-center justify-between">
                          <span>{language === 'pl' ? 'Rekomendowane przez AI' : 'Suggested translation'}</span>
                          <button
                            onClick={() => handlePlaySentenceAudio(res.correctTranslation, ACCENTS[i % ACCENTS.length], i)}
                            disabled={playingAudioIndex === i}
                            className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
                            title="Posłuchaj wymowy"
                          >
                            <span className="text-[10px]">{ACCENT_FLAGS[ACCENTS[i % ACCENTS.length]]}</span>
                            {playingAudioIndex === i ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Volume2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
`;

code = code.replace(/<div className="text-xs text-content-muted font-bold mb-1 uppercase tracking-wider">\{language === 'pl' \? 'Rekomendowane przez AI' : 'Suggested translation'\}<\/div>/g, buttonHTML.trim());

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
console.log('patched AI generator');
