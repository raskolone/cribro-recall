const fs = require('fs');
let code = fs.readFileSync('components/settings/SettingsScreen.tsx', 'utf8');

const importAuth = "import { useAuth } from '../../context/AuthContext';\n";
if (!code.includes(importAuth)) {
  code = importAuth + code;
}

if (!code.includes('linkGoogleAccount')) {
  code = code.replace(
    "const { language } = useLanguage();",
    "const { language } = useLanguage();\n    const { linkGoogleAccount, user } = useAuth();\n    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);\n    const [linkError, setLinkError] = useState<string | null>(null);"
  );

  const googleSection = `
                <Card>
                    <h2 className="text-xl font-bold mb-4">{language === 'pl' ? 'Konto i Integracje' : 'Account & Integrations'}</h2>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-content-muted mb-2">
                                {language === 'pl' ? 'Powiąż swoje konto z Google, aby móc logować się za jego pomocą i korzystać z Google Drive.' : 'Link your account with Google to log in via Google and use Google Drive.'}
                            </p>
                            {user?.providerData?.some((p: any) => p.providerId === 'google.com') ? (
                                <div className="text-green-500 font-bold text-sm">✓ {language === 'pl' ? 'Konto połączone z Google' : 'Account linked to Google'}</div>
                            ) : (
                                <Button 
                                    onClick={async () => {
                                        setIsLinkingGoogle(true);
                                        setLinkError(null);
                                        try {
                                            await linkGoogleAccount();
                                        } catch (err: any) {
                                            setLinkError(err.message || 'Error linking account');
                                        } finally {
                                            setIsLinkingGoogle(false);
                                        }
                                    }}
                                    isLoading={isLinkingGoogle}
                                    variant="secondary"
                                >
                                    {language === 'pl' ? 'Połącz z Google' : 'Link with Google'}
                                </Button>
                            )}
                            {linkError && <p className="text-red-500 text-sm mt-2">{linkError}</p>}
                        </div>
                    </div>
                </Card>
`;

  code = code.replace(
    "<Card>\n                    <h2 className=\"text-xl font-bold mb-4\">Revision Program</h2>",
    googleSection + "\n                <Card>\n                    <h2 className=\"text-xl font-bold mb-4\">Revision Program</h2>"
  );

  fs.writeFileSync('components/settings/SettingsScreen.tsx', code);
}
