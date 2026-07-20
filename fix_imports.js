import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// Find all imports
const importRegex = /^import\s+.*?;\s*$/gm;
let match;
let imports = [];
let cleanedContent = content;

while ((match = importRegex.exec(content)) !== null) {
  imports.push(match[0]);
}

cleanedContent = cleanedContent.replace(importRegex, '');

// Also clean up the leftover from extractJSON:
// "    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {\n    return text.substring(startIndex, endIndex + 1);\n  }\n  \n  // Fallback to trimming\n  return text.trim();\n};\n"
const badBlockRegex = /^\s*if \(startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex\) \{\s*return text\.substring\(startIndex, endIndex \+ 1\);\s*\}\s*\/\/\s*Fallback to trimming\s*return text\.trim\(\);\s*\};?/m;
cleanedContent = cleanedContent.replace(badBlockRegex, '');

// The old regex to remove the beginning of the bad block was:
// const leftoverStart = content.indexOf("    // If no markdown block, try to find");
const badBlockStartRegex = /^\s*\/\/\s*If no markdown block, try to find the first '\{' or '\[' and last '\}' or '\]'[\s\S]*?startIndex = firstBracket;\s*\}/m;
cleanedContent = cleanedContent.replace(badBlockStartRegex, '');

const badBlockMiddleRegex = /^\s*if \(lastBrace !== -1 && lastBracket !== -1\) \{[\s\S]*?endIndex = lastBracket;\s*\}/m;
cleanedContent = cleanedContent.replace(badBlockMiddleRegex, '');

const badBlockVars = /^\s*let startIndex = -1;\s*let endIndex = -1;/m;
cleanedContent = cleanedContent.replace(badBlockVars, '');

const badBlockIndex = /^\s*const firstBrace = text\.indexOf\('\{'\);\s*const firstBracket = text\.indexOf\('\['\);\s*const lastBrace = text\.lastIndexOf\('\}'\);\s*const lastBracket = text\.lastIndexOf\('\]'\);/m;
cleanedContent = cleanedContent.replace(badBlockIndex, '');

fs.writeFileSync(file, imports.join('\n') + '\n\n' + cleanedContent.trim());
console.log("Fixed file structure");
