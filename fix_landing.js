import fs from 'fs';

let content = fs.readFileSync('components/landing/LandingPage.tsx', 'utf-8');

// The file has a duplicate FeatureCard definition and a broken handleGoogleLogin.
// Let's strip out from the first `  const FeatureCard` to `    if (containerRef.current.children.length > 0) {` 
// and replace it with a clean handleGoogleLogin and a single FeatureCard.

content = content.replace(/const FeatureCard =[\s\S]*?const containerRef = useRef<HTMLDivElement>\(null\);\s*useEffect\(\(\) => \{\s*if \(containerRef\.current\.children\.length > 0\) \{/,
`  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
        console.error("Google login failed:", error);
      }
    }
  };

  const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="bg-base-200/50 backdrop-blur-sm border border-white/5 p-6 rounded-2xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 group">
      <Icon className="w-6 h-6 text-primary mb-4 group-hover:scale-110 transition-transform duration-300" />
      <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
      <p className="text-content-muted text-xs font-mono uppercase tracking-widest">{description}</p>
    </div>
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && containerRef.current.children.length > 0) {`
);

fs.writeFileSync('components/landing/LandingPage.tsx', content);
console.log("Fixed LandingPage.tsx");
