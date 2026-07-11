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

code = helper + code;
fs.writeFileSync('services/geminiService.ts', code);
console.log("Helper prepended.");
