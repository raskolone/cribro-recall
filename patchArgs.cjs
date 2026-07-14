const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

code = code.replace(/const fetchDriveFiles = async \(\) => \{\};/g, "const fetchDriveFiles = async (mode?: string) => {};");
code = code.replace(/const handlePdfUpload = async \(e: any, mode: string\) => \{\};/g, "const handlePdfUpload = async (e: any, mode?: string) => {};");

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
