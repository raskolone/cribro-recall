const fs = require('fs');
let code = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf-8');

code = code.replace(/  const \[isProfileMenuOpen, setIsProfileMenuOpen\] = useState\(false\);\n/, '');
code = code.replace(/        if \(isProfileMenuOpen\) \{\n          setIsProfileMenuOpen\(false\);\n          return;\n        \}\n/, '');
code = code.replace(/isProfileMenuOpen, /, '');

fs.writeFileSync('components/dashboard/Dashboard.tsx', code);
