const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

if (!code.includes("showMessageModal")) {
  code = code.replace(
    "const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);",
    "const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);\n  const [showMessageModal, setShowMessageModal] = useState(false);\n  const [messageTitle, setMessageTitle] = useState('Wiadomość od nauczyciela');\n  const [messageText, setMessageText] = useState('');\n  const [isSendingMessage, setIsSendingMessage] = useState(false);"
  );
}

// Add the button
const changePassButton = `                                                                                                    {i18n.t("Zmień hasło")}
                                                                                                  </Button>`;
const messageButton = `                                                                                                    {i18n.t("Zmień hasło")}
                                                                                                  </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setMessageTitle('Wiadomość od nauczyciela');
                            setMessageText('');
                            setShowMessageModal(true);
                          }}
                        >
                          Wyślij wiadomość
                        </Button>`;
code = code.replace(changePassButton, messageButton);

// Add the function
const funcTarget = `const handleChangePassword = async () => {`;
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
code = code.replace(funcTarget, messageFunc + funcTarget);

// Add the modal JSX near Change Password Modal
const modalTarget = `{/* Change Password Modal */}`;
const messageModalJSX = `
      {/* Send Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <Card className="w-full shadow-2xl border-primary/20">
              <h3 className="text-xl font-bold mb-4">Wyślij wiadomość do {selectedUser?.firstName || selectedUser?.username}</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-1">Tytuł wiadomości</label>
                  <input
                    type="text"
                    value={messageTitle}
                    onChange={(e) => setMessageTitle(e.target.value)}
                    className="w-full bg-base-300 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-1">Treść wiadomości</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={4}
                    className="w-full bg-base-300 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary resize-none"
                    placeholder="Wpisz treść wiadomości..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowMessageModal(false)}>Anuluj</Button>
                <Button onClick={handleSendMessage} isLoading={isSendingMessage} disabled={!messageText.trim()}>Wyślij</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
`;
code = code.replace(modalTarget, messageModalJSX + modalTarget);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
