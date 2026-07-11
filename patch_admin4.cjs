const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const newProcessDriveFile = `
  const processDriveFile = async (file: any) => {
    try {
      setIsGenerating(true);
      setShowDriveModal(false);
      setShowAIModal(true);
      const token = await connectGoogleDrive();
      
      await handleBatchImport('', '', { id: file.id, mimeType: file.mimeType, token });
    } catch (err: any) {
`;

code = code.replace(/const processDriveFile = async \(file: any\) => \{\s*try \{\s*setIsGenerating\(true\);\s*setShowDriveModal\(false\);\s*setShowAIModal\(true\);\s*const token = await connectGoogleDrive\(\);\s*let textContent = '';\s*let pdfBase64 = '';\s*if \(file\.mimeType === 'application\/pdf'\) \{\s*const res = await fetch\(`https:\/\/www\.googleapis\.com\/drive\/v3\/files\/\$\{file\.id\}\?alt=media`, \{\s*headers: \{ Authorization: `Bearer \$\{token\}` \},\s*\}\);\s*const blob = await res\.blob\(\);\s*const reader = new FileReader\(\);\s*pdfBase64 = await new Promise<string>\(\(resolve\) => \{\s*reader\.onloadend = \(\) => resolve\(reader\.result as string\);\s*reader\.readAsDataURL\(blob\);\s*\}\);\s*\} else \{\s*const res = await fetch\(`https:\/\/www\.googleapis\.com\/drive\/v3\/files\/\$\{file\.id\}\/export\?mimeType=text\/plain`, \{\s*headers: \{ Authorization: `Bearer \$\{token\}` \},\s*\}\);\s*textContent = await res\.text\(\);\s*\}\s*await handleBatchImport\(textContent, pdfBase64, \{ id: file\.id, mimeType: file\.mimeType, token \}\);\s*\} catch \(err: any\) \{/, newProcessDriveFile.trim());

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('patched admin4');
