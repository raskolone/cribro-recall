const fs = require('fs');
const path = 'services/geminiService.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /const generateContentWithFallback = async \(params: any\) => \{[\s\S]*?throw lastError;\n\};/;

const newFallback = `const generateContentWithFallback = async (params: any) => {
  const model = "gemini-1.5-flash";
  console.log(\`Attempting generation with \${model}...\`);
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timed out after 15 seconds")), 15000);
  });
  
  const apiCall = ai.models.generateContent({
    ...params,
    model,
  });

  return await Promise.race([apiCall, timeoutPromise]) as any;
};`;

if(regex.test(content)) {
  content = content.replace(regex, newFallback);
  fs.writeFileSync(path, content);
  console.log("Patched fallback successfully");
} else {
  console.log("Regex did not match");
}
