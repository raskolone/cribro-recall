const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

code = code.replace(/duration: "random\(([-0-9.]+), ([-0-9.]+)\)"/g, 'duration: gsap.utils.random($1, $2)');
code = code.replace(/delay: "random\(([-0-9.]+), ([-0-9.]+)\)"/g, 'delay: gsap.utils.random($1, $2)');
code = code.replace(/repeatDelay: "random\(([-0-9.]+), ([-0-9.]+)\)"/g, 'repeatDelay: gsap.utils.random($1, $2) - 0.2');

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
