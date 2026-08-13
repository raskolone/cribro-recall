const fs = require('fs');
const file = 'components/dashboard/AIExerciseGeneratorScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const startIndex = content.indexOf(`const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string; logs?: string; currentModel?: string }> = ({ language, level, currentModel }) => {`);
const endIndex = content.indexOf(`const AILoadingButton = ({ isLoading, onClick, children, className, disabled, loadingText, variant = 'primary' }: any) => {`);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string; logs?: string; currentModel?: string }> = ({ language, level, currentModel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tangledRef = useRef<SVGPathElement>(null);
  const spiralRef = useRef<SVGPathElement>(null);
  const arrowRef = useRef<SVGPathElement>(null);
  const statusTextRef = useRef<HTMLParagraphElement>(null);

  const tangledPath = useMemo(() => {
    const points = [];
    const numPoints = 200;
    for (let i = 0; i < numPoints; i++) {
      const t = i * 0.33;
      const radius = 25 + 75 * Math.abs(Math.sin(t * 1.7) * Math.cos(t * 2.3) * Math.sin(t * 3.1));
      const angle = t * 3.4;
      points.push({
        x: 170 + radius * Math.cos(angle),
        y: 150 + radius * Math.sin(angle)
      });
    }
    let d = \`M \${points[0].x} \${points[0].y} \`;
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      d += \`Q \${points[i].x} \${points[i].y}, \${xc} \${yc} \`;
    }
    return d;
  }, []);

  const spiralPath = useMemo(() => {
    let d = "";
    const turns = 8;
    const maxRadius = 90;
    for (let i = 0; i <= 360 * turns; i += 4) {
      const angle = (i * Math.PI) / 180;
      const radius = (maxRadius * i) / (360 * turns);
      const x = 530 + radius * Math.cos(angle);
      const y = 150 + radius * Math.sin(angle);
      if (i === 0) d = \`M \${x} \${y} \`;
      else d += \`L \${x} \${y} \`;
    }
    return d;
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tangledLength = tangledRef.current?.getTotalLength() || 4000;
      const spiralLength = spiralRef.current?.getTotalLength() || 4000;
      const arrowLength = arrowRef.current?.getTotalLength() || 300;

      gsap.set(tangledRef.current, { strokeDasharray: tangledLength, strokeDashoffset: tangledLength });
      gsap.set(spiralRef.current, { strokeDasharray: spiralLength, strokeDashoffset: spiralLength });
      gsap.set(arrowRef.current, { strokeDasharray: arrowLength, strokeDashoffset: arrowLength });

      const tl = gsap.timeline();

      tl.to(tangledRef.current, { strokeDashoffset: 0, duration: 2, ease: "power2.inOut" })
        .to(arrowRef.current, { strokeDashoffset: 0, duration: 0.6, ease: "power1.inOut" })
        .to(spiralRef.current, { strokeDashoffset: 0, duration: 2, ease: "power2.inOut" });

      gsap.to(spiralRef.current, {
        rotation: 360,
        transformOrigin: "530px 150px",
        duration: 20,
        repeat: -1,
        ease: "none",
        delay: 4.6
      });

      gsap.to(tangledRef.current, {
        scale: 0.95,
        rotation: -5,
        transformOrigin: "170px 150px",
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2
      });

      gsap.to(arrowRef.current, {
        opacity: 0.5,
        x: 6,
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2.6
      });

      gsap.to(statusTextRef.current, {
        opacity: 0.5,
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
      <div className="relative w-full max-w-[700px] aspect-[7/3] mb-8 flex items-center justify-center select-none origin-center">
        <div className="absolute inset-0 bg-[#7CB342]/10 blur-[80px] rounded-full" />
        
        <svg
          className="w-full h-full drop-shadow-[0_0_12px_rgba(124,179,66,0.3)]"
          viewBox="0 0 700 300"
          fill="none"
        >
          <defs>
            <filter id="crayonLoader" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          {/* Left: Tangled chaotic string */}
          <path
            ref={tangledRef}
            d={tangledPath}
            stroke="#7CB342"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#crayonLoader)"
          />

          {/* Middle: Arrow/Thread flowing */}
          <path
            ref={arrowRef}
            d="M 290 150 L 410 150 M 380 120 L 415 150 L 380 180"
            stroke="#7CB342"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#crayonLoader)"
          />

          {/* Right: Organized spiral */}
          <path
            ref={spiralRef}
            d={spiralPath}
            stroke="#7CB342"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#crayonLoader)"
          />
        </svg>
      </div>

      <h3 className="text-2xl font-bold text-white mb-3 tracking-tight flex items-center justify-center gap-3">
        <Sparkles className="w-6 h-6 text-[#7CB342] animate-pulse" />
        <span>{language === 'pl' ? 'Upraszczanie i porządkowanie...' : 'Simplifying and organizing...'}</span>
      </h3>
      
      <p ref={statusTextRef} className="text-base text-[#7CB342]/80 font-medium tracking-wide max-w-sm mx-auto">
        {language === 'pl' 
          ? 'Sztuczna inteligencja eliminuje chaos i tworzy przejrzystą strukturę.' 
          : 'AI is eliminating chaos and building a clear structure.'}
      </p>

      {currentModel && (
        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#7CB342]/10 border border-[#7CB342]/30 text-[#7CB342] text-xs font-semibold shadow-[0_0_20px_rgba(124,179,66,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7CB342] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7CB342]" />
          </span>
          <Sparkles className="w-3.5 h-3.5 text-[#7CB342]" />
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

  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync(file, newContent, 'utf8');
  console.log("Successfully replaced");
} else {
  console.log("Failed to find boundaries");
}
