import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Update handleChangePassword
content = content.replace(
  /await updateDoc\(userRef, \{ requirePasswordChange: true \}\);/,
  "await updateDoc(userRef, { requirePasswordChange: true, tempPassword: newPasswordForUser });"
);
content = content.replace(
  /const updated = \{ \.\.\.selectedUser, requirePasswordChange: true \};/,
  "const updated = { ...selectedUser, requirePasswordChange: true, tempPassword: newPasswordForUser };"
);

// Update handleCreateUser to store tempPassword
content = content.replace(
  /requirePasswordChange: true,/,
  "requirePasswordChange: true,\n      tempPassword: newUserPassword,"
);

// Add the "Skopiuj aktualne hasło" button
const copyButtonString = `
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => {
                            setNewPasswordForUser('');
                            setChangePasswordError('');
                            setShowChangePasswordModal(true);
                          }}
                        >
                          Zmień hasło
                        </Button>
                        {selectedUser?.tempPassword && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-primary/10 text-primary border-transparent hover:bg-primary/20"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedUser.tempPassword || '');
                              alert('Skopiowano hasło: ' + selectedUser.tempPassword);
                            }}
                          >
                            📋 Skopiuj aktualne hasło
                          </Button>
                        )}
`;

content = content.replace(
  /<Button\s+variant="secondary"\s+size="sm"\s+onClick=\{\(\) => \{\s+setNewPasswordForUser\(''\);\s+setChangePasswordError\(''\);\s+setShowChangePasswordModal\(true\);\s+\}\}\s*>\s*Zmień hasło\s*<\/Button>/,
  copyButtonString
);

fs.writeFileSync(file, content);
console.log("Updated AdminPanel.tsx");
