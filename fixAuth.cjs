const fs = require('fs');
let code = fs.readFileSync('context/AuthContext.tsx', 'utf8');

if (!code.includes('linkGoogleAccount: () => Promise<void>;')) {
  code = code.replace(
    "connectGoogleDrive: () => Promise<string>;",
    "connectGoogleDrive: () => Promise<string>;\n  linkGoogleAccount: () => Promise<void>;"
  );
  
  code = code.replace("signInAnonymously", "signInAnonymously,\n  linkWithPopup");

  const linkCode = `
  const linkGoogleAccount = async () => {
    try {
      if (!auth.currentUser) throw new Error('No user logged in');
      const provider = new GoogleAuthProvider();
      // Add drive scope just in case they link now, so they have it
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      await linkWithPopup(auth.currentUser, provider);
    } catch (error) {
      console.error('Failed to link Google account:', error);
      throw error;
    }
  };
`;

  code = code.replace(
    "const connectGoogleDrive = async (): Promise<string> => {",
    linkCode + "\n  const connectGoogleDrive = async (): Promise<string> => {"
  );

  code = code.replace(
    "connectGoogleDrive }>",
    "connectGoogleDrive, linkGoogleAccount }>"
  );

  fs.writeFileSync('context/AuthContext.tsx', code);
}
