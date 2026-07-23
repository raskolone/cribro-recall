const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const flameComponent = `
const AnimatedFlame = () => {
  const flameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!flameRef.current) return;
    
    let ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1 });
      
      tl.to(flameRef.current, {
        duration: 0.12,
        scaleY: 1.15,
        scaleX: 0.85,
        rotation: 4,
        skewX: 3,
        opacity: 0.8,
        ease: "power1.inOut"
      })
      .to(flameRef.current, {
        duration: 0.15,
        scaleY: 0.9,
        scaleX: 1.1,
        rotation: -4,
        skewX: -3,
        opacity: 1,
        ease: "power1.inOut"
      })
      .to(flameRef.current, {
        duration: 0.1,
        scaleY: 1.2,
        scaleX: 0.8,
        rotation: 6,
        skewX: 5,
        opacity: 0.9,
        ease: "power1.inOut"
      })
      .to(flameRef.current, {
        duration: 0.12,
        scaleY: 0.95,
        scaleX: 1.05,
        rotation: -2,
        skewX: -2,
        opacity: 0.7,
        ease: "power1.inOut"
      });
    }, flameRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <span 
      ref={flameRef}
      className="text-orange-400 text-lg drop-shadow-[0_0_12px_rgba(255,140,0,0.9)] inline-block"
      style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
    >
      🔥
    </span>
  );
};
`;

if (!code.includes("const AnimatedFlame")) {
  code = code.replace(
    "const Dashboard: React.FC<DashboardProps> = ({",
    flameComponent + "\nconst Dashboard: React.FC<DashboardProps> = ({"
  );
}

const targetHtml = `<motion.span 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }} 
                      transition={{ repeat: Infinity, duration: 1.5 }} 
                      className="text-orange-500 text-lg drop-shadow-[0_0_8px_rgba(255,165,0,0.8)] inline-block"
                    >
                      🔥
                    </motion.span>`;

if (code.includes(targetHtml)) {
  code = code.replace(targetHtml, "<AnimatedFlame />");
} else {
  // Try fallback replacement if formatting is different
  const fallbackRegex = /<motion\.span[\s\S]*?🔥[\s\S]*?<\/motion\.span>/;
  code = code.replace(fallbackRegex, "<AnimatedFlame />");
}

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
