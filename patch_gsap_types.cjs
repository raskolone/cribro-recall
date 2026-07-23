const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

// replace () => gsap.utils.random(X, Y) with "random(X, Y)"
// skewX: () => gsap.utils.random(-8, 8), -> skewX: "random(-8, 8)",

code = code.replace(/skewX: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'skewX: "random($1, $2)"');
code = code.replace(/scaleY: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'scaleY: "random($1, $2)"');
code = code.replace(/scaleX: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'scaleX: "random($1, $2)"');
code = code.replace(/rotation: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'rotation: "random($1, $2)"');
code = code.replace(/opacity: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'opacity: "random($1, $2)"');
code = code.replace(/duration: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'duration: "random($1, $2)"');
code = code.replace(/delay: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'delay: "random($1, $2)"');
code = code.replace(/repeatDelay: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\) - 0.2/g, 'repeatDelay: "random($1, $2)"'); // Will just use random

// for y: () => -gsap.utils.random(20, 40), -> y: "random(-40, -20)",
code = code.replace(/y: \(\) => -gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'y: "random(-$2, -$1)"');
code = code.replace(/x: \(\) => gsap\.utils\.random\(([-0-9.]+), ([-0-9.]+)\)/g, 'x: "random($1, $2)"');

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
