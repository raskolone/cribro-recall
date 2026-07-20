import fs from 'fs';

let adminContent = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

adminContent = adminContent.replace(
  `      // 1. Change password via firebase-admin endpoint
      await changeUserPassword(selectedUser.id, newPasswordForUser);`,
  `      // 1. Change password via firebase-admin endpoint
      try {
        await changeUserPassword(selectedUser.id, newPasswordForUser);
      } catch (apiErr: any) {
        let msg = apiErr.message;
        try {
          const parsed = JSON.parse(apiErr.message);
          if (parsed.error) msg = parsed.error;
        } catch (e) {}
        throw new Error("API Error: " + msg);
      }`
);

adminContent = adminContent.replace(
  `                      onClick={() => {
                        navigator.clipboard.writeText(newPasswordForUser);
                        alert('Hasło zostało skopiowane do schowka!');
                      }}`,
  `                      onClick={async () => {
                        try {
                           await navigator.clipboard.writeText(newPasswordForUser);
                           setChangePasswordError('');
                        } catch (e) {
                           setChangePasswordError('Nie udało się skopiować hasła.');
                        }
                      }}`
);

adminContent = adminContent.replace(
  `      alert('Hasło zostało pomyślnie zmienione! Uczeń zostanie poproszony o jego zmianę przy kolejnym logowaniu.');`,
  `      // Removed alert to prevent iframe block`
);

fs.writeFileSync('components/admin/AdminPanel.tsx', adminContent);
console.log("Patched admin panel");
