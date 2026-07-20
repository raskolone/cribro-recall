import fs from 'fs';

let file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf-8');

// I will just use regex to remove from line `useEffect(() => {` before `if (textRef.current && !audioCtx)`
// all the way to `} catch (e) { \n // Ignore audio errors \n } };`
// and replace it with a clean playSound function and a clean useEffect for textRef animation.

content = content.replace(/  useEffect\(\(\) => \{\s*if \(textRef\.current && !audioCtx\).*?\}\s*catch \(e\) \{\s*\/\/ Ignore audio errors\s*\}\s*\};/s, 
`  const playSound = () => {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      // Ignore audio errors
    }
  };

  useEffect(() => {
    if (textRef.current && textRef.current.children.length > 0) {
      gsap.fromTo(textRef.current,
        { opacity: 0, y: 15, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)" }
      );
    }
  }, []);`);

fs.writeFileSync(file, content);
console.log("Fixed AIExerciseGeneratorScreen");
