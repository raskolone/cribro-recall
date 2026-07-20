import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// The leftover block starts with "    // If no markdown block, try to find the first '{' or '[' and last '}' or ']'"
// and ends with "  return text.trim();\n};\n\n"
const leftoverStart = content.indexOf("    // If no markdown block, try to find");
const leftoverEnd = content.indexOf("  return text.trim();\n};\n", leftoverStart) + "  return text.trim();\n};\n".length;

if (leftoverStart !== -1 && leftoverEnd !== -1) {
    content = content.substring(0, leftoverStart) + content.substring(leftoverEnd);
    fs.writeFileSync(file, content);
    console.log("Fixed syntax leftovers");
} else {
    console.error("Leftovers not found");
}

