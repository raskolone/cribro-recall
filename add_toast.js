import fs from 'fs';

let file = 'components/admin/AdminPanel.tsx';
let content = fs.readFileSync(file, 'utf-8');

// 1. Add toastMessage state
const stateMatch = 'const [newPasswordForUser, setNewPasswordForUser] = useState(\'\');';
const stateReplacement = stateMatch + '\n  const [toastMessage, setToastMessage] = useState<{text: string, id: number} | null>(null);\n  const showToast = (text: string) => {\n    const id = Date.now();\n    setToastMessage({text, id});\n    setTimeout(() => {\n      setToastMessage(prev => prev?.id === id ? null : prev);\n    }, 3000);\n  };';
content = content.replace(stateMatch, stateReplacement);

// 2. Add to handleChangePassword
content = content.replace(
  /setShowChangePasswordModal\(false\);\s*setNewPasswordForUser\(''\);/,
  "setShowChangePasswordModal(false);\n      setNewPasswordForUser('');\n      showToast('Hasło zostało zmienione.');"
);

// 3. Replace alert('Zmieniono nazwę.')
content = content.replace(
  /alert\('Zmieniono nazwę.'\);/,
  "showToast('Zmiana nazwy konta została zapisana.');"
);

// 4. Replace alert('Skopiowano hasło: ...')
content = content.replace(
  /alert\('Skopiowano hasło: ' \+ selectedUser\.tempPassword\);/,
  "showToast('Hasło zostało skopiowane.');"
);

// 5. Inject Toast UI before the final closing div
const toastUI = `
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-[100] px-6 py-3 rounded-xl bg-base-300 border border-white/10 shadow-2xl flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-white font-bold">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};`;
content = content.replace(/    <\/div>\s*\);\s*\};\s*export default AdminPanel;/, toastUI + '\n\nexport default AdminPanel;');

fs.writeFileSync(file, content);
console.log("Toast added to AdminPanel");
