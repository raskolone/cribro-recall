import fs from 'fs';
const content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');
const lines = content.split('\n');

const startIndex = lines.findIndex(line => line.includes("const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string }> = ({ language, level }) => {"));
const endIndex = lines.findIndex((line, i) => i > startIndex && line === "  );") + 1; // get to end of component
const toReplace = lines.slice(startIndex, endIndex + 1).join('\n');

const replacement = `const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string }> = ({ language, level }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const jengaRef = useRef<HTMLDivElement>(null);

  const steps = language === 'pl' ? [
    "Układanie klocków gramatyki...",
    "Budowanie poprawnej składni...",
    "Dobieranie odpowiedniego słownictwa...",
    "Sprawdzanie naturalności zdań...",
    "Opracowywanie unikalnego kontekstu...",
    "Dopasowywanie do poziomu CEFR...",
    "Finalizowanie ćwiczenia AI..."
  ] : [
    "Stacking grammar blocks...",
    "Building correct syntax...",
    "Selecting appropriate vocabulary...",
    "Checking sentence naturalness...",
    "Designing unique context...",
    "Aligning with CEFR level...",
    "Finalizing AI exercise..."
  ];

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStepIdx(prev => (prev + 1) % steps.length);
    }, 2200);
    return () => clearInterval(stepInterval);
  }, [steps.length]);

  useEffect(() => {
    if (!jengaRef.current) return;
    const blocks = jengaRef.current.querySelectorAll('.jenga-block');
    
    const tl = gsap.timeline({ repeat: -1 });
    
    // Build phase
    tl.fromTo(blocks, 
      { y: -150, opacity: 0, rotation: () => Math.random() * 40 - 20 },
      { 
        y: 0, 
        opacity: 1, 
        rotation: 0, 
        duration: 0.4, 
        stagger: {
          each: 0.1,
          from: "start"
        },
        ease: "back.out(1.5)"
      }
    )
    // Wait a bit
    .to({}, { duration: 1.5 })
    // Fall apart phase
    .to(blocks, {
      y: () => Math.random() * 100 + 50,
      x: () => Math.random() * 100 - 50,
      rotation: () => Math.random() * 180 - 90,
      opacity: 0,
      duration: 0.6,
      stagger: {
        each: 0.05,
        from: "random"
      },
      ease: "power2.in"
    })
    .to({}, { duration: 0.5 }); // pause before restart
    
    return () => {
      tl.killTweensOf("*");
      tl.kill();
    };
  }, []);

  useEffect(() => {
    if (textRef.current) {
      gsap.fromTo(textRef.current,
        { opacity: 0, y: 15, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)" }
      );
    }
  }, [currentStepIdx]);

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto py-14 px-6 flex flex-col items-center justify-center bg-base-200/40 border border-white/5 backdrop-blur-xl rounded-2xl relative overflow-hidden min-h-[380px] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
      
      {/* Jenga Blocks Animation */}
      <div ref={jengaRef} className="relative w-48 h-36 flex flex-col justify-end items-center mb-8 gap-[2px]">
        {/* We'll make 5 rows of 3 blocks each */}
        {[...Array(5)].map((_, rowIndex) => (
          <div key={\`row-\${rowIndex}\`} className={\`flex \${rowIndex % 2 === 0 ? 'flex-row gap-[2px]' : 'flex-col gap-[2px]'}\`}>
            {[...Array(3)].map((_, colIndex) => (
              <div 
                key={\`block-\${rowIndex}-\${colIndex}\`}
                className={\`jenga-block bg-primary/20 border border-primary/40 rounded-sm shadow-[0_0_10px_rgba(114,240,180,0.2)] \${rowIndex % 2 === 0 ? 'w-10 h-[14px]' : 'w-[124px] h-[10px]'}\`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Interactive loading step */}
      <div className="space-y-2 text-center z-10 max-w-md mt-4">
        <h4 className="text-[11px] font-bold text-primary tracking-widest uppercase font-mono animate-pulse">
          {language === 'pl' ? 'Generowanie z AI' : 'Generating with AI'}
        </h4>
        <div ref={textRef} className="text-base font-bold text-white tracking-tight min-h-[24px]">
          {steps[currentStepIdx]}
        </div>
        <p className="text-xs text-content-muted mt-2">
          {language === 'pl' 
            ? 'Budujemy dla Ciebie wysoce spersonalizowaną lekcję. To potrwa tylko chwilę...' 
            : 'Assembling a custom practice session tailored to your needs. This will only take a moment...'}
        </p>
      </div>
    </div>
  );
};`;

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content.replace(toReplace, replacement));
