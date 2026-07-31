const fs = require('fs');

let sidebarCode = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const targetImport = `import { collection, collectionGroup, query, where, onSnapshot } from 'firebase/firestore';`;
const newImport = `import { collection, collectionGroup, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';`;
sidebarCode = sidebarCode.replace(targetImport, newImport);

fs.writeFileSync('components/dashboard/Sidebar.tsx', sidebarCode);

