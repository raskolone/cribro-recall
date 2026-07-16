import fs from 'fs';
const content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf-8');

const target = Buffer.from(`const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string }> = ({ language, level }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);

  const steps = language === 'pl' ? [
    "Przeszukiwanie historii Twoich lekcji...",
    "Analizowanie Twoich mocnych i słabych stron...",
    "Wybieranie odpowiedniego zestawu słownictwa...",
    "Generowanie naturalnych zdań z kontekstem...",
    "Dopasowywanie wybranego poziomu CEFR...",
    "Optymalizowanie spersonalizowanych wskazówek...",
    "Finalizacja i formatowanie ćwiczenia AI..."
  ] : [
    "Scanning your lesson history...",
    "Analyzing historical strengths and weaknesses...",
    "Selecting appropriate vocabulary lists...",
    "Drafting natural, real-world context sentences...",
    "Aligning difficulty with selected CEFR level...",
    "Optimizing helpful hint suggestions...",
    "Finalizing and formatting your custom AI exercise..."
  ];

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStepIdx(prev => (prev + 1) % steps.length);
    }, 2200);
    return () => clearInterval(stepInterval);
  }, [steps.length]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Orbit/Sphere rotating animation via GSAP
    gsap.to(orbitRef.current, {
      rotation: 360,
      duration: 10,
      repeat: -1,
      ease: "none"
    });

    // Sub-dots pulsing via GSAP
    gsap.to(".orbit-dot", {
      scale: 1.4,
      opacity: 0.3,
      duration: 1.5,
      yoyo: true,
      repeat: -1,
      stagger: 0.3,
      ease: "power1.inOut"
    });

    // Background stars floating via GSAP
    const stars = containerRef.current.querySelectorAll('.star-particle');
    stars.forEach(star => {
      gsap.to(star, {
        y: "random(-30, 30)",
        x: "random(-30, 30)",
        opacity: "random(0.1, 0.8)",
        scale: "random(0.5, 1.4)",
        duration: "random(3, 5)",
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      });
    });

    return () => {
      gsap.killTweensOf("*");
    };
  }, [level]);

  useEffect(() => {
    // Animate step text change via GSAP
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
      {[...Array(15)].map((_, i) => (
        <div 
          key={i} 
          className="star-particle absolute w-1 h-1 bg-primary/40 rounded-full"
          style={{
            top: \`\${Math.random() * 100}%\`,
            left: \`\${Math.random() * 100}%\`,
          }}
        />
      ))}

      {/* Main glowing sphere & orbits */}
      <div className="relative w-36 h-36 flex items-center justify-center mb-6">
        {/* Core glowing AI sphere */}
        <div className="absolute w-20 h-20 bg-primary/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute w-12 h-12 bg-primary/30 rounded-full border border-primary/50 flex items-center justify-center shadow-[0_0_25px_rgba(114,240,180,0.4)]">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
        </div>
        
        {/* Orbit lines */}
        <div ref={orbitRef} className="absolute w-28 h-28 border border-primary/20 rounded-full flex items-center justify-center">
          <div className="orbit-dot absolute -top-1 w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_rgba(114,240,180,0.8)]" />
          <div className="orbit-dot absolute -bottom-1 w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_rgba(114,240,180,0.8)]" />
          <div className="orbit-dot absolute -left-1 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <div className="orbit-dot absolute -right-1 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
        </div>
        
        {/* Secondary diagonal orbit */}
        <div className="absolute w-28 h-28 border border-white/5 rounded-full rotate-45" />
      </div>

      {/* Interactive loading step */}
      <div className="space-y-2 text-center z-10 max-w-md">
        <h4 className="text-[11px] font-bold text-primary tracking-widest uppercase font-mono animate-pulse">
          {language === 'pl' ? 'Generowanie z AI' : 'Generating with AI'}
        </h4>
        <div ref={textRef} className="text-base font-bold text-white tracking-tight min-h-[24px]">
          {steps[currentStepIdx]}
        </div>
        <p className="text-xs text-content-muted">
          {language === 'pl' 
            ? 'Układamy dla Ciebie wysoce spersonalizowaną lekcję. To potrwa tylko chwilę...' 
            : 'Assembling a custom practice session tailored to your needs. This will only take a moment...'}
        </p>
      </div>

      {/* Real-time floating terminology tags */}
      <div ref={badgesRef} className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 opacity-45 select-none">
        <span className="text-[9px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">CEFR {level || 'B2'}</span>
        <span className="text-[9px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">{language === 'pl' ? 'Gramatyka' : 'Grammar'}</span>
        <span className="text-[9px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">{language === 'pl' ? 'Słownictwo' : 'Vocabulary'}</span>
        <span className="text-[9px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">{language === 'pl' ? 'Kontekst' : 'Context'}</span>
      </div>
    </div>
  );
};`).toString();

const replacement = Buffer.from(`const AIGenerationLoader: React.FC<{ language: 'pl' | 'en'; level: string }> = ({ language, level }) => {
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
      <div ref={jengaRef} className="relative w-48 h-36 flex flex-col justify-end items-center mb-8">
        {/* We'll make 5 rows of 3 blocks each */}
        {[...Array(5)].map((_, rowIndex) => (
          <div key={\`row-\${rowIndex}\`} className={\`flex \${rowIndex % 2 === 0 ? 'flex-row gap-1' : 'flex-col -mb-4 mt-1 space-y-1'}\`}>
            {[...Array(3)].map((_, colIndex) => (
              <div 
                key={\`block-\${rowIndex}-\${colIndex}\`}
                className={\`jenga-block bg-primary/20 border border-primary/40 rounded-sm shadow-[0_0_10px_rgba(114,240,180,0.2)] \${rowIndex % 2 === 0 ? 'w-10 h-4' : 'w-32 h-3'}\`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Interactive loading step */}
      <div className="space-y-2 text-center z-10 max-w-md">
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
};`).toString();

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content.replace(target, replacement));
