const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const messageFunc = `
  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      const newMessage = {
        title: messageTitle || 'Wiadomość',
        text: messageText,
        createdAt: new Date().toISOString()
      };
      await updateDoc(userRef, { adminMessage: newMessage });
      
      const updated = { ...selectedUser, adminMessage: newMessage };
      setSelectedUser(updated);
      setUsers(users.map(u => u.id === updated.id ? updated : u));
      
      showToast('Wiadomość została wysłana.');
      setShowMessageModal(false);
      setMessageText('');
    } catch (e: any) {
      alert('Błąd podczas wysyłania: ' + e.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

`;

code = code.replace("  const handleChangePassword = async (e: any) => {", messageFunc + "  const handleChangePassword = async (e: any) => {");

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
