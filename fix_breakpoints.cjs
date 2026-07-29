const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

code = code.replace(
  /className="block sm:hidden/g,
  'className="block md:hidden'
);

code = code.replace(
  /className="hidden sm:block/g,
  'className="hidden md:block'
);

// We should also replace the top tabs segment which has hidden sm:flex
code = code.replace(
  /className="hidden sm:flex/g,
  'className="hidden md:flex'
);

// The card padding is p-0 sm:p-8, let's make it md:p-8
code = code.replace(
  /p-0 sm:p-8 border-none sm:border-solid sm:border sm:border-white\/10 bg-\[#05080f\] sm:bg-\[#0d131d\] backdrop-blur-2xl relative overflow-visible sm:overflow-hidden flex flex-col rounded-none sm:rounded-3xl shadow-none sm:shadow-\[0_20px_60px_rgba\(0,0,0,0.55\)\] max-w-2xl mx-auto min-h-screen sm:min-h-0/g,
  'p-0 md:p-8 border-none md:border-solid md:border md:border-white/10 bg-[#05080f] md:bg-[#0d131d] backdrop-blur-2xl relative overflow-visible md:overflow-hidden flex flex-col rounded-none md:rounded-3xl shadow-none md:shadow-[0_20px_60px_rgba(0,0,0,0.55)] max-w-2xl mx-auto min-h-screen md:min-h-0'
);

// And we have some grids like grid-cols-1 sm:grid-cols-2 that maybe we want md:grid-cols-2?
// For mobile redesign, it's inside md:hidden anyway, so the grids there are just sm:grid-cols-2. Let's leave them.

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
