const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const svgFlameComponent = `
const AnimatedFlame = () => {
  const flameGroupRef = useRef<SVGGElement>(null);
  const outerFlameRef = useRef<SVGPathElement>(null);
  const innerFlameRef = useRef<SVGPathElement>(null);
  const coreFlameRef = useRef<SVGPathElement>(null);
  const particlesRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!flameGroupRef.current) return;
    
    let ctx = gsap.context(() => {
      // Main wind flicker effect
      gsap.to(flameGroupRef.current, {
        skewX: () => gsap.utils.random(-8, 8),
        scaleY: () => gsap.utils.random(0.9, 1.15),
        scaleX: () => gsap.utils.random(0.9, 1.05),
        rotation: () => gsap.utils.random(-5, 5),
        duration: 0.15,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        repeatRefresh: true,
        transformOrigin: "center bottom"
      });
      
      // Outer flame path morphing/flicker
      gsap.to(outerFlameRef.current, {
        opacity: () => gsap.utils.random(0.7, 1),
        duration: 0.1,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
        repeatRefresh: true
      });

      // Inner flame dynamic scaling
      gsap.to(innerFlameRef.current, {
        scaleY: () => gsap.utils.random(0.8, 1.2),
        duration: 0.12,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        repeatRefresh: true,
        transformOrigin: "center bottom"
      });
      
      // Core flame glowing
      gsap.to(coreFlameRef.current, {
        opacity: () => gsap.utils.random(0.8, 1),
        duration: 0.08,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
        repeatRefresh: true
      });

      // Sparks/particles flying up
      if (particlesRef.current && particlesRef.current.children) {
        gsap.utils.toArray(particlesRef.current.children).forEach((spark: any, i) => {
          gsap.set(spark, { opacity: 0, y: 0, x: 0, scale: gsap.utils.random(0.4, 1) });
          gsap.to(spark, {
            y: () => -gsap.utils.random(20, 40),
            x: () => gsap.utils.random(-15, 15),
            opacity: 0,
            scale: 0,
            duration: () => gsap.utils.random(0.6, 1.2),
            delay: () => gsap.utils.random(0, 1),
            repeat: -1,
            ease: "power1.out"
          });
          gsap.to(spark, {
            opacity: 1,
            duration: 0.2,
            delay: () => gsap.utils.random(0, 1),
            repeat: -1,
            repeatDelay: () => gsap.utils.random(0.4, 1) - 0.2,
            yoyo: true
          });
        });
      }

    }, flameGroupRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative w-6 h-6 flex items-center justify-center">
      {/* Glow effect behind */}
      <div className="absolute inset-0 bg-orange-500 blur-[8px] rounded-full opacity-40 animate-pulse"></div>
      
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible z-10" style={{ filter: 'drop-shadow(0 0 4px rgba(255,100,0,0.8))' }}>
        <g ref={particlesRef}>
          <circle cx="50" cy="80" r="3" fill="#ffeb3b" />
          <circle cx="45" cy="75" r="2" fill="#ff9800" />
          <circle cx="55" cy="85" r="2.5" fill="#ffc107" />
        </g>
        
        <g ref={flameGroupRef}>
          {/* Outer Flame */}
          <path 
            ref={outerFlameRef}
            d="M50,90 C50,90 20,70 20,40 C20,10 50,0 50,0 C50,0 80,10 80,40 C80,70 50,90 50,90 Z" 
            fill="url(#flameGrad1)" 
          />
          {/* Inner Flame */}
          <path 
            ref={innerFlameRef}
            d="M50,85 C50,85 30,70 30,45 C30,25 50,15 50,15 C50,15 70,25 70,45 C70,70 50,85 50,85 Z" 
            fill="url(#flameGrad2)" 
          />
          {/* Core Flame */}
          <path 
            ref={coreFlameRef}
            d="M50,80 C50,80 40,70 40,55 C40,40 50,35 50,35 C50,35 60,40 60,55 C60,70 50,80 50,80 Z" 
            fill="#ffffff" 
          />
        </g>
        
        <defs>
          <linearGradient id="flameGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff0000" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#ff5722" />
            <stop offset="100%" stopColor="#ff9800" />
          </linearGradient>
          <linearGradient id="flameGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff9800" />
            <stop offset="60%" stopColor="#ffc107" />
            <stop offset="100%" stopColor="#ffeb3b" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
`;

if (!code.includes("const AnimatedFlame = () => {")) {
  code = code.replace(
    "const Dashboard: React.FC = () => {",
    svgFlameComponent + "\nconst Dashboard: React.FC = () => {"
  );
  fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
  console.log("Successfully injected AnimatedFlame.");
} else {
  console.log("AnimatedFlame already exists.");
}

