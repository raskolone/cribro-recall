const fs = require('fs');
let content = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

// Check if db is imported
if (!content.includes('import { db } from')) {
    content = content.replace("import { auth } from '../../firebase';", "import { auth, db } from '../../firebase';");
    if (!content.includes('import { db } from')) {
      content = content.replace("import { useAuth }", "import { db } from '../../firebase';\nimport { doc, updateDoc } from 'firebase/firestore';\nimport { useAuth }");
    }
} else if (!content.includes('updateDoc')) {
    content = content.replace("import { db } from", "import { doc, updateDoc } from 'firebase/firestore';\nimport { db } from");
}

content = content.replace(/import\('\.\.\/\.\.\/firebase'\)\.then\(m=>m\.db\)/g, "db");
content = content.replace(/import\('firebase\/firestore'\)\.then\(\(\{ doc, updateDoc \}\) => \{([^}]+)\}\);/g, "const updateLessonStatus = async () => { $1 }; updateLessonStatus();");

fs.writeFileSync('components/dashboard/Sidebar.tsx', content);
