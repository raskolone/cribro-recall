import fs from 'fs';
let content = fs.readFileSync('components/landing/LandingPage.tsx', 'utf-8');
content = content.replace(/  const handleGoogleLogin = async \(\) => \{\s*try \{\s*await loginWithGoogle\(\);\s*\} catch \(error: any\) \{\s*if \(error\?\.code !== 'auth\/popup-closed-by-user' && error\?\.code !== 'auth\/cancelled-popup-request'\) \{\s*console\.error\("Google login failed:", error\);\s*\}\s*\}\s*\};\s*/, '');
fs.writeFileSync('components/landing/LandingPage.tsx', content);
console.log("Removed duplicate handleGoogleLogin");
