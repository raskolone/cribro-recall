const fs = require('fs');
const file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// Colors
content = content.replace(/#8BC34A/g, '#72F0B4');
content = content.replace(/#7CB342/g, '#72F0B4');

// GSAP timing
content = content.replace(/duration: 3, \n        ease: "power2.inOut"/g, 'duration: 5, \n        ease: "power2.inOut"');
content = content.replace(/duration: 30, \/\/ Very slow rotation/g, 'duration: 45, // Extremely slow rotation');
content = content.replace(/duration: 2\.5,/g, 'duration: 4,');

// Drop shadow colors
content = content.replace(/floodColor="#7CB342"/g, 'floodColor="#72F0B4"');

fs.writeFileSync(file, content, 'utf8');
console.log("Patched colors and timing");
