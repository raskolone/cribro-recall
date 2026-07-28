const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

// Ensure generateLessonSummary and generateBulkLessonSummary are imported
if (!code.includes('generateLessonSummary')) {
  code = code.replace(
    /import \{ extractJSON \} from '\.\.\/\.\.\/services\/geminiService';/,
    "import { extractJSON, generateLessonSummary, generateBulkLessonSummary } from '../../services/geminiService';"
  );
  if (!code.includes('generateLessonSummary')) { // fallback if the above replace didn't work
    code = code.replace(
      /import \{\s*useAuth\s*\} from '\.\.\/\.\.\/context\/AuthContext';/,
      "import { useAuth } from '../../context/AuthContext';\nimport { generateLessonSummary, generateBulkLessonSummary } from '../../services/geminiService';"
    );
  }
}

// 1. handleFileUpload
code = code.replace(
  /const token = await auth\.currentUser\?\.getIdToken\(\);\s*const res = await fetch\('\/api\/gemini\/lesson-summary', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json', 'Authorization': `Bearer \$\{token\}` \},\s*body: JSON\.stringify\(\{\s*pdfBase64: base64,\s*students: mapStudents\(\)\s*\}\)\s*\}\);\s*if \(!res\.ok\) throw new Error\(await res\.text\(\)\);\s*const data = await res\.json\(\);/,
  `
          const studentsStr = mapStudents().map((s: any) => \`ID: \${s.id} | Imię/Nazwisko: \${s.name} | Poziom: \${s.level} | Opis: \${s.description}\`).join('\\n');
          const data = await generateLessonSummary('', base64, studentsStr);
`
);

// 2. handleGenerateFromNotes
code = code.replace(
  /const token = await auth\.currentUser\?\.getIdToken\(\);\s*if \(!token\) throw new Error\("Authentication required"\);\s*const res = await fetch\('\/api\/gemini\/lesson-summary', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json', 'Authorization': `Bearer \$\{token\}` \},\s*body: JSON\.stringify\(\{\s*notes: rawMeetingNotes,\s*students: mapStudents\(\)\s*\}\)\s*\}\);\s*if \(!res\.ok\) throw new Error\(await res\.text\(\)\);\s*const data = await res\.json\(\);/,
  `
      const studentsStr = mapStudents().map((s: any) => \`ID: \${s.id} | Imię/Nazwisko: \${s.name} | Poziom: \${s.level} | Opis: \${s.description}\`).join('\\n');
      const data = await generateLessonSummary(rawMeetingNotes, '', studentsStr);
`
);

// 3. generateBulkSummary
code = code.replace(
  /const token = await auth\.currentUser\?\.getIdToken\(\);\s*if \(!token\) throw new Error\("Authentication required"\);\s*const res = await fetch\('\/api\/gemini\/import-lessons-batch', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json', 'Authorization': `Bearer \$\{token\}` \},\s*body: JSON\.stringify\(\{\s*textContent: notes,\s*pdfBase64,\s*driveFile,\s*students: mapStudents\(\)\s*\}\)\s*\}\);\s*if \(!res\.ok\) throw new Error\(await res\.text\(\)\);\s*const data = await res\.json\(\);/,
  `
      if (driveFile) {
        throw new Error("Direct Drive file fetching is not supported in client-side mode yet. Please upload PDF or paste text.");
      }
      const studentsStr = mapStudents().map((s: any) => \`ID: \${s.id} | Imię/Nazwisko: \${s.name} | Poziom: \${s.level} | Opis: \${s.description}\`).join('\\n');
      const data = await generateBulkLessonSummary(notes || '', pdfBase64 || '', studentsStr);
`
);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log("Patched AdminPanel.tsx");
