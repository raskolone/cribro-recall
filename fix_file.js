import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// First, restore extractJSON by replacing the mangled part
// The original extractJSON was:
const goodExtractJSON = `
export const extractJSON = (text: string): string => {
  if (!text) return "{}";
  
  const jsonBlockRegex = /\`\`\`(?:json)?\\s*([\\s\\S]*?)\\s*\`\`\`/i;
  const match = text.match(jsonBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }
  
  if (startIdx !== -1) {
    const endBrace = text.lastIndexOf('}');
    const endBracket = text.lastIndexOf(']');
    
    let endIdx = -1;
    if (endBrace !== -1 && endBracket !== -1) {
      endIdx = Math.max(endBrace, endBracket);
    } else if (endBrace !== -1) {
      endIdx = endBrace;
    } else if (endBracket !== -1) {
      endIdx = endBracket;
    }
    
    if (endIdx !== -1 && endIdx > startIdx) {
      return text.substring(startIdx, endIdx + 1);
    }
  }
  
  return text.trim();
};
`;

const fallbackHelper = `
const generateContentWithFallback = async (params: any) => {
  const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastError;
  for (const model of models) {
    try {
      console.log(\`Attempting generation with \${model}...\`);
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      return response;
    } catch (e: any) {
      console.warn(\`Model \${model} failed:\`, e?.status || e?.message);
      lastError = e;
      if (e?.status === 400 && e?.message?.includes("not found")) {
         // Model doesn't exist, try next
         continue;
      }
      if (e?.status === 503 || e?.status === 429) {
         // High demand or rate limit, try next
         continue;
      }
      // For other errors, it might be a prompt issue, but let's try next anyway for robustness
    }
  }
  throw lastError;
};
`;

// we need to find where the mangled extractJSON starts.
const extractJsonStart = content.indexOf('export const extractJSON =');
// where does generateContentWithFallback start
const fallbackStart = content.indexOf('const generateContentWithFallback =');
// where does it end
const endOfFallback = content.indexOf('throw lastError;\n};', fallbackStart) + 'throw lastError;\n};'.length;

if (extractJsonStart !== -1 && fallbackStart !== -1) {
    // wait, what is after the fallback?
    // we should just remove everything from extractJsonStart to endOfFallback
    content = content.substring(0, extractJsonStart) + goodExtractJSON + '\n' + fallbackHelper + '\n' + content.substring(endOfFallback);
}

fs.writeFileSync(file, content);
console.log("Restored extractJSON and moved helper");
