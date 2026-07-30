const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const target = `                            if (confirm('Czy na pewno chcesz usunąć to konto? Tej operacji nie można cofnąć.')) {
                              const token = localStorage.getItem('adminToken') || ''; // Adjust as needed to get a valid token. Wait! Does AdminPanel have auth token?
                              // Let's use auth.currentUser.getIdToken()
                              auth.currentUser?.getIdToken().then(token => {
                                fetch(\`/api/admin-users/users/\${selectedUser.id}\`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Authorization': \`Bearer \${token}\`
                                  }
                                }).then(res => res.json()).then(data => {
                                  if(data.error) throw new Error(data.error);
                                  return deleteDoc(doc(db, 'users', selectedUser.id));
                                }).then(() => {
                                  setUsers(users.filter(u => u.id !== selectedUser.id));
                                  setSelectedUser(null);
                                  alert('Konto zostało usunięte.');
                                }).catch(err => alert('Błąd podczas usuwania: ' + err.message));
                              });
                            }`;

const replacement = `                            if (confirm('Czy na pewno chcesz usunąć to konto? Tej operacji nie można cofnąć.')) {
                              handleDeleteUser(selectedUser.id);
                            }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('components/admin/AdminPanel.tsx', code);
    console.log("Patched AdminPanel.tsx (Delete User Again)");
} else {
    console.log("Target not found");
}
