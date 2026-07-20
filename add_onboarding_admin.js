import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

const onboardingButton = `
                        <Button
                          variant="secondary"
                          size="sm"
                          className={selectedUser.onboardingCompleted ? "bg-primary/20 text-primary border-transparent" : "bg-base-300 text-content-muted"}
                          onClick={() => {
                            const newStatus = !selectedUser.onboardingCompleted;
                            const userRef = doc(db, 'users', selectedUser.id);
                            updateDoc(userRef, { onboardingCompleted: newStatus }).then(() => {
                              const updated = { ...selectedUser, onboardingCompleted: newStatus };
                              setSelectedUser(updated);
                              setUsers(users.map(u => u.id === updated.id ? updated : u));
                              showToast(newStatus ? 'Onboarding oznaczony jako ukończony.' : 'Onboarding zresetowany (pojawi się ponownie).');
                            }).catch(err => alert('Błąd: ' + err.message));
                          }}
                        >
                          {selectedUser.onboardingCompleted ? '✅ Onboarding: Zrobiony' : '⬛ Onboarding: Brak'}
                        </Button>
`;

content = content.replace(
  /<Button\s+variant="secondary"\s+size="sm"\s+className=\{selectedUser\.isSuspended \?/,
  onboardingButton + "\n                        <Button \n                          variant=\"secondary\" \n                          size=\"sm\"\n                          className={selectedUser.isSuspended ?"
);

fs.writeFileSync(file, content);
console.log("Added onboarding toggle to AdminPanel");
