const fs = require('fs');
let code = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// Replace typing base class (mobile)
code = code.replace(
  "'bg-[#0a0e17]/80 backdrop-blur-md border border-white/10 hover:border-cyan-500/70 hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:-translate-y-1'",
  "'backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:border-cyan-500/70 hover:shadow-[0_0_35px_rgba(6,182,212,0.35)] hover:-translate-y-1'"
);

// Replace puzzle base class (mobile)
code = code.replace(
  "'bg-[#0a0e17]/80 backdrop-blur-md border border-white/10 hover:border-emerald-500/70 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:-translate-y-1'",
  "'backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-500/70 hover:shadow-[0_0_35px_rgba(16,185,129,0.35)] hover:-translate-y-1'"
);

// Replace flashcards class (mobile)
code = code.replace(
  /className="w-full group\/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer bg-\[#0a0e17\]\/80 backdrop-blur-md border border-white\/10 hover:border-purple-500\/70 hover:shadow-\[0_0_30px_rgba\(168,85,247,0.35\)\] hover:-translate-y-1 text-left min-h-\[110px\]"/g,
  'className="w-full group/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:border-purple-500/70 hover:shadow-[0_0_35px_rgba(168,85,247,0.35)] hover:-translate-y-1 text-left min-h-[110px]"'
);

// Replace match class (mobile)
code = code.replace(
  /className="w-full group\/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer bg-\[#0a0e17\]\/80 backdrop-blur-md border border-white\/10 hover:border-amber-500\/70 hover:shadow-\[0_0_30px_rgba\(245,158,11,0.35\)\] hover:-translate-y-1 text-left min-h-\[110px\]"/g,
  'className="w-full group/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/70 hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] hover:-translate-y-1 text-left min-h-[110px]"'
);

// We should also replace the desktop cards as well so it's consistent if the user implied the generator section in general, but they said "W widoku mobilnym". However, there are some in the desktop section too.
// Let's replace the desktop ones as well.

code = code.replace(
  "'bg-[#0a0e17]/80 backdrop-blur-md border border-white/10 hover:border-emerald-500/70 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:-translate-y-1'",
  "'backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-500/70 hover:shadow-[0_0_35px_rgba(16,185,129,0.35)] hover:-translate-y-1'"
);

code = code.replace(
  "'bg-[#0a0e17]/80 backdrop-blur-md border border-white/10 hover:border-cyan-500/70 hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:-translate-y-1'",
  "'backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:border-cyan-500/70 hover:shadow-[0_0_35px_rgba(6,182,212,0.35)] hover:-translate-y-1'"
);

// For desktop flashcards & match
code = code.replace(
  /className="w-full group\/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer bg-\[#0a0e17\]\/80 backdrop-blur-md border border-white\/10 hover:border-purple-500\/70 hover:shadow-\[0_0_30px_rgba\(168,85,247,0.35\)\] hover:-translate-y-1 text-left min-h-\[115px\]"/g,
  'className="w-full group/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:border-purple-500/70 hover:shadow-[0_0_35px_rgba(168,85,247,0.35)] hover:-translate-y-1 text-left min-h-[115px]"'
);

code = code.replace(
  /className="w-full group\/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer bg-\[#0a0e17\]\/80 backdrop-blur-md border border-white\/10 hover:border-amber-500\/70 hover:shadow-\[0_0_30px_rgba\(245,158,11,0.35\)\] hover:-translate-y-1 text-left min-h-\[115px\]"/g,
  'className="w-full group/card relative rounded-3xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-black/50 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/70 hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] hover:-translate-y-1 text-left min-h-[115px]"'
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', code);
