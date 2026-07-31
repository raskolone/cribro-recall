const fs = require('fs');
let code = fs.readFileSync('components/dashboard/WordCard.tsx', 'utf8');

const targetImport = `import { playAudio } from '../../utils/audioUtils';`;
const newImport = `import { playAudio, unlockAudioContext } from '../../utils/audioUtils';`;
code = code.replace(targetImport, newImport);

const targetBlock = `    // iOS Workaround
    let nativeAudio: HTMLAudioElement | null = null;
    if (word.language === 'English') {
      nativeAudio = new Audio();
      nativeAudio.play().catch(() => {});
    } else {
      // For base64 audio playAudio handles Context creation, but iOS might block AudioContext if not resumed synchronously. 
      // Fortunately playAudio in audioUtils tries to resume it.
    }`;
const newBlock = `    // iOS Workaround
    let nativeAudio: HTMLAudioElement | null = null;
    if (word.language === 'English') {
      nativeAudio = new Audio();
      nativeAudio.play().catch(() => {});
    } else {
      unlockAudioContext();
    }`;

code = code.replace(targetBlock, newBlock);
fs.writeFileSync('components/dashboard/WordCard.tsx', code);
