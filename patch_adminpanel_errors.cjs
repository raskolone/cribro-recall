const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

if (!code.includes('summaryError')) {
  code = code.replace(
    /const \[isGenerating, setIsGenerating\] = useState\(false\);/,
    "const [isGenerating, setIsGenerating] = useState(false);\n  const [summaryError, setSummaryError] = useState('');\n  const [bulkSummaryError, setBulkSummaryError] = useState('');"
  );
}

// 1. single handleFileUpload
code = code.replace(
  /setIsGenerating\(true\);\s*try \{/,
  "setIsGenerating(true);\n        setSummaryError('');\n        try {"
);

code = code.replace(
  /alert\("Error: " \+ err\.message\);/,
  "setSummaryError(err.message || 'Wystąpił nieznany błąd podczas generowania podsumowania.');"
);

// 2. single handleGenerateFromNotes
code = code.replace(
  /setIsGenerating\(true\);\s*try \{/,
  "setIsGenerating(true);\n    setSummaryError('');\n    try {"
);

code = code.replace(
  /alert\("Error generating summary: " \+ err\.message\);/,
  "setSummaryError(err.message || 'Wystąpił nieznany błąd podczas generowania podsumowania.');"
);

// 3. bulk
code = code.replace(
  /setIsGenerating\(true\);\s*try \{/,
  "setIsGenerating(true);\n    setBulkSummaryError('');\n    try {"
);

code = code.replace(
  /alert\("Error generating bulk summary: " \+ err\.message\);/,
  "setBulkSummaryError(err.message || 'Wystąpił nieznany błąd podczas generowania podsumowania zbiorczego.');"
);
code = code.replace(
  /alert\("Unexpected response format"\);/,
  "setBulkSummaryError('Unexpected response format');"
);

// Render summaryError in AI Modal
code = code.replace(
  /<textarea\s*value=\{rawMeetingNotes\}/,
  `{summaryError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-4 text-sm font-medium">
                {summaryError}
              </div>
            )}
            <textarea
              value={rawMeetingNotes}`
);

// Render bulkSummaryError in Bulk Modal
code = code.replace(
  /<textarea\s*value=\{bulkNotes\}/,
  `{bulkSummaryError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-4 text-sm font-medium">
                {bulkSummaryError}
              </div>
            )}
            <textarea
              value={bulkNotes}`
);


fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log("Patched AdminPanel.tsx error handling");
