const fs = require('fs');

const file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const paths = JSON.parse(fs.readFileSync('yarn_paths.json', 'utf8'));

const startIndex = content.indexOf(`const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string; logs?: string; currentModel?: string }> = ({ language, level, currentModel }) => {`);
const endIndex = content.indexOf(`const AILoadingButton = ({ isLoading, onClick, children, className, disabled, loadingText, variant = 'primary' }: any) => {`);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find boundaries!");
    process.exit(1);
}

const replacement = `const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string; logs?: string; currentModel?: string }> = ({ language, level, currentModel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tangledRef = useRef<SVGPathElement>(null);
  const spiralRef = useRef<SVGPathElement>(null);
  const statusTextRef = useRef<HTMLParagraphElement>(null);

  // High-density paths generated for realistic yarn effect
  const tangledPath = useMemo(() => "${paths.tangle}", []);
  const spiralPath = useMemo(() => "${paths.spiral}", []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tangledLength = tangledRef.current?.getTotalLength() || 10000;
      const spiralLength = spiralRef.current?.getTotalLength() || 4000;

      // Start with the tangle fully drawn, but the spiral/line hidden
      gsap.set(tangledRef.current, { strokeDasharray: tangledLength, strokeDashoffset: 0 });
      gsap.set(spiralRef.current, { strokeDasharray: spiralLength, strokeDashoffset: spiralLength });

      const tl = gsap.timeline();

      // The string flows out of the tangle and forms the spiral
      tl.to(spiralRef.current, { 
        strokeDashoffset: 0, 
        duration: 4, 
        ease: "power2.inOut" 
      });

      // Spin the spiral smoothly to simulate continuous organizing
      gsap.to(spiralRef.current, {
        rotation: -360,
        transformOrigin: "540px 150px", // Center of the spiral
        duration: 8,
        repeat: -1,
        ease: "none",
        delay: 4
      });

      // Subtle pulse and rotate on the yarn ball to simulate it unwinding
      gsap.to(tangledRef.current, {
        rotation: 15,
        scale: 0.96,
        transformOrigin: "160px 150px", // Center of the tangle
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

      gsap.to(statusTextRef.current, {
        opacity: 0.6,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-8 text-center w-full max-w-4xl mx-auto my-auto animate-fade-in relative min-h-[420px]">
      <div className="relative w-full max-w-[700px] aspect-[7/3] mb-8 flex items-center justify-center select-none origin-center overflow-visible">
        <div className="absolute inset-0 bg-[#7CB342]/5 blur-[100px] rounded-full" />
        
        <svg
          className="w-full h-full overflow-visible"
          viewBox="0 0 700 300"
          fill="none"
        >
          {/* A drop shadow filter specifically tailored for a 3D yarn effect */}
          <defs>
            <filter id="yarnShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
            </filter>
            <filter id="yarnGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#7CB342" floodOpacity="0.2" />
            </filter>
          </defs>

          <g filter="url(#yarnGlow)">
            <g filter="url(#yarnShadow)">
              {/* Left: Dense Tangled Yarn Ball */}
              <path
                ref={tangledRef}
                d={tangledPath}
                stroke="#8BC34A"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />

              {/* Right: Perfect Spiral and connecting line */}
              <path
                ref={spiralRef}
                d={spiralPath}
                stroke="#8BC34A"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
              />
            </g>
          </g>
        </svg>
      </div>

      <h3 className="text-2xl font-bold text-white mb-3 tracking-tight flex items-center justify-center gap-3">
        <Sparkles className="w-6 h-6 text-[#8BC34A] animate-pulse" />
        <span>{language === 'pl' ? 'Upraszczanie i porządkowanie...' : 'Simplifying and organizing...'}</span>
      </h3>
      
      <p ref={statusTextRef} className="text-base text-[#8BC34A]/80 font-medium tracking-wide max-w-sm mx-auto">
        {language === 'pl' 
          ? 'Sztuczna inteligencja eliminuje chaos i tworzy przejrzystą strukturę.' 
          : 'AI is eliminating chaos and building a clear structure.'}
      </p>

      {currentModel && (
        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#8BC34A]/10 border border-[#8BC34A]/30 text-[#8BC34A] text-xs font-semibold shadow-[0_0_20px_rgba(139,195,74,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8BC34A] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8BC34A]" />
          </span>
          <Sparkles className="w-3.5 h-3.5 text-[#8BC34A]" />
          <span>
            {language === 'pl' ? 'Generowanie z użyciem: ' : 'Generating with: '}
            <strong className="text-white font-bold">{formatAIModelName(currentModel)}</strong>
          </span>
        </div>
      )}
    </div>
  );
};

`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(file, content, 'utf8');
console.log("Successfully replaced loader component!");
