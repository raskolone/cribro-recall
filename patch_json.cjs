const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf-8');

const helper = `export const extractJSON = (text: string): string => {
  if (!text) return "{}";
  
  // Try to find markdown code blocks first
  const jsonBlockRegex = /\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i;
  const match = text.match(jsonBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // If no markdown block, try to find the first '{' or '[' and last '}' or ']'
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  
  let startIndex = -1;
  let endIndex = -1;
  
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }
  
  if (lastBrace !== -1 && lastBracket !== -1) {
    endIndex = Math.max(lastBrace, lastBracket);
  } else if (lastBrace !== -1) {
    endIndex = lastBrace;
  } else if (lastBracket !== -1) {
    endIndex = lastBracket;
  }
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    return text.substring(startIndex, endIndex + 1);
  }
  
  // Fallback to trimming
  return text.trim();
};

`;

code = code.replace("import { db } from '../config/firebase';", "import { db } from '../config/firebase';\n\n" + helper);

// Replace all occurrences of the parsing block
const parseBlockPattern = /let jsonText = response\.text(?:\?)?\.trim\(\)(?: \|\| "\{\}")?;\s*if\s*\(jsonText\.startsWith\('```json'\)\)\s*\{\s*jsonText = jsonText\.replace\(\/\^```json\/,\s*''\)\.replace\(\/```\$\/,\s*''\)\.trim\(\);\s*\}\s*else\s*if\s*\(jsonText\.startsWith\('```'\)\)\s*\{\s*jsonText = jsonText\.replace\(\/\^```\/,\s*''\)\.replace\(\/```\$\/,\s*''\)\.trim\(\);\s*\}/g;

code = code.replace(parseBlockPattern, 'let jsonText = extractJSON(response.text || "");');

fs.writeFileSync('services/geminiService.ts', code);
console.log("Updated geminiService.ts with extractJSON");
