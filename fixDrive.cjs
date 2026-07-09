const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

if (!code.includes('driveError')) {
  code = code.replace("const [driveLoading, setDriveLoading] = useState(false);", "const [driveLoading, setDriveLoading] = useState(false);\n  const [driveError, setDriveError] = useState<string | null>(null);");
}

code = code.replace(
  "alert('Nie udało się pobrać plików z dysku Google.');",
  `if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup')) {
        setDriveError('Aby zalogować się do Google Drive, otwórz aplikację w nowej karcie (przycisk w prawym górnym rogu) lub zezwól na wyskakujące okienka.');
      } else {
        setDriveError('Nie udało się połączyć z dyskiem Google.');
      }`
);

code = code.replace(
  "setDriveLoading(true);\n      setShowDriveModal(true);",
  "setDriveLoading(true);\n      setShowDriveModal(true);\n      setDriveError(null);"
);

const driveModalErrorHtml = `
            {driveError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-4 text-sm">
                {driveError}
              </div>
            )}
            {driveLoading ? (
`;

code = code.replace("{driveLoading ? (", driveModalErrorHtml);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
