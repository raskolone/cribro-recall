import fs from 'fs';
let content = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const targetStr = `  const handleSelectUser = (user: UserWithId) => {
    setSelectedUser(user);
    fetchUserLogsAndStats(user.id);
  };`;

const newStr = `  const handleSelectUser = (user: UserWithId) => {
    setSelectedUser(user);
    if (onUserSelect) onUserSelect(user.id);
    fetchUserLogsAndStats(user.id);
  };`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('components/admin/AdminPanel.tsx', content);
console.log("Patched correctly");
