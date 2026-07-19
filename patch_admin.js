import fs from 'fs';
let content = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

const saveTarget = `  const handleSaveProfile = async (silent = false) => {
    if (!selectedUser) return;
    setIsSavingProfile(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        level: profileForm.level,
        description: profileForm.description,
        aiPrompt: profileForm.aiPrompt
      });
      const updatedUser = { ...selectedUser, ...profileForm };
      setSelectedUser(updatedUser);
      setUsers(users.map(u => u.id === selectedUser.id ? updatedUser : u));
      if (!silent) alert('Zapisano profil pomyślnie!');
    } catch (e: any) {
      alert('Błąd podczas zapisywania: ' + e.message);
    } finally {
      setIsSavingProfile(false);
    }
  };`;

const saveReplacement = `  const handleSaveProfile = async (silent = false, formState = profileForm) => {
    if (!selectedUser) return;
    setIsSavingProfile(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        firstName: formState.firstName,
        lastName: formState.lastName,
        level: formState.level,
        description: formState.description,
        aiPrompt: formState.aiPrompt
      });
      const updatedUser = { ...selectedUser, ...formState };
      setSelectedUser(updatedUser);
      setUsers(users.map(u => u.id === selectedUser.id ? updatedUser : u));
      if (!silent) alert('Zapisano profil pomyślnie!');
    } catch (e: any) {
      alert('Błąd podczas zapisywania: ' + e.message);
    } finally {
      setIsSavingProfile(false);
    }
  };`;

content = content.replace(saveTarget, saveReplacement);

const selectTarget = `                  onChange={(e) => {
                    setProfileForm(prev => ({ ...prev, level: e.target.value }));
                    setTimeout(() => handleSaveProfile(true), 0);
                  }}`;

const selectReplacement = `                  onChange={(e) => {
                    const newForm = { ...profileForm, level: e.target.value };
                    setProfileForm(newForm);
                    handleSaveProfile(true, newForm);
                  }}`;

content = content.replace(selectTarget, selectReplacement);

// Also we should check if other fields have onBlur that might be buggy,
// but onBlur should be fine since it's triggered after state is updated.
// Let's just fix them all to be safe? No, for inputs, onChange updates the state, onBlur triggers save.
// Because it's a controlled component, the state IS updated before onBlur fires.
// However, to be fully safe, let's just make onBlur use the latest state if we can.
// But we can't easily pass it to onBlur without duplicating the state. It should be fine.

fs.writeFileSync('components/admin/AdminPanel.tsx', content);
