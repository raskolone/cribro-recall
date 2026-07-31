const fs = require('fs');
let code = fs.readFileSync('components/admin/TopicDatabaseScreen.tsx', 'utf8');

const targetState = "const [dbPhrasals, setDbPhrasals] = useState<PhrasalVerbItem[]>([]);";
const newTargetState = targetState + "\n  const [allUsers, setAllUsers] = useState<any[]>([]);";

code = code.replace(targetState, newTargetState);

const targetFetch = `      const usersMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const uData = d.data();
        const name = (uData.firstName || uData.lastName)
          ? \`\${uData.firstName || ''} \${uData.lastName || ''}\`.trim()
          : uData.username || 'Kursant';
        usersMap[d.id] = name;
      });`;

const newFetch = `      const usersMap: Record<string, string> = {};
      const usersList = [];
      usersSnap.docs.forEach(d => {
        const uData = d.data();
        const name = (uData.firstName || uData.lastName)
          ? \`\${uData.firstName || ''} \${uData.lastName || ''}\`.trim()
          : uData.username || 'Kursant';
        usersMap[d.id] = name;
        if(uData.role !== 'admin' && uData.role !== 'teacher') {
           usersList.push({ id: d.id, name });
        }
      });
      setAllUsers(usersList);`;

code = code.replace(targetFetch, newFetch);

fs.writeFileSync('components/admin/TopicDatabaseScreen.tsx', code);
