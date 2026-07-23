const fs = require('fs');
const file = 'components/admin/AdminTestGenerator.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /interface AdminTestGeneratorProps \{\n  user: User;\n\}/,
  "interface AdminTestGeneratorProps {\n  user?: any;\n  users?: any[];\n}"
);

content = content.replace(
  /const AdminTestGenerator: React\.FC<AdminTestGeneratorProps> = \(\{ user \}\) => \{/,
  `const AdminTestGenerator: React.FC<AdminTestGeneratorProps> = ({ user: initialUser, users = [] }) => {\n  const [selectedUserId, setSelectedUserId] = useState<string>(initialUser?.id || '');\n  const user = initialUser || users.find(u => u.id === selectedUserId);`
);

content = content.replace(
  /useEffect\(\(\) => \{\n    fetchLessons\(\);\n    fetchTests\(\);\n  \}, \[user\.id\]\);/,
  "useEffect(() => {\n    if(user?.id) { fetchLessons(); fetchTests(); }\n  }, [user?.id]);"
);

content = content.replace(
  /const fetchLessons = async \(\) => \{\n    if \(\!user\.id\) return;/,
  "const fetchLessons = async () => {\n    if (!user?.id) return;"
);
content = content.replace(
  /const fetchTests = async \(\) => \{\n    if \(\!user\.id\) return;/,
  "const fetchTests = async () => {\n    if (!user?.id) return;"
);

// We need to add the select dropdown at the very top of the render block
content = content.replace(
  /return \(\n    <div className="space-y-6">/,
  `return (
    <div className="space-y-6">
      {(!initialUser && users.length > 0) && (
        <Card className="p-6 bg-base-200/50">
          <label className="block text-sm font-bold text-content-muted mb-2">Wybierz kursanta</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full bg-base-100 border border-white/10 rounded-xl p-3 outline-none focus:border-primary/50 text-white font-medium"
          >
            <option value="">-- Wybierz kursanta --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.firstName || u.lastName ? \`\${u.firstName || ''} \${u.lastName || ''}\`.trim() : u.username}
              </option>
            ))}
          </select>
        </Card>
      )}
      {!user ? (
         <div className="text-center p-8 text-content-muted">Proszę wybrać kursanta, aby wygenerować test.</div>
      ) : (`
);

content = content.replace(
  /export default AdminTestGenerator;/,
  `  )}
    </div>
  );
};
export default AdminTestGenerator;`
);

fs.writeFileSync(file, content);
