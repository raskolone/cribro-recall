const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const helper = `
async function callOpenAIServerFallback(prompt, system, schema) {
  const openaiKey = process.env.VITE_OPENAI_API_KEY;
  if (openaiKey) {
    try {
      console.log("[Server] Attempting OpenAI GPT model...");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${openaiKey}\`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system || "You are a helpful assistant." },
            { role: "user", content: prompt }
          ],
          response_format: schema ? { type: "json_object" } : { type: "text" },
          temperature: 0.7
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      } else {
        console.warn("[Server] OpenAI request failed:", await res.text());
      }
    } catch(e) {
      console.warn("[Server] OpenAI error:", e);
    }
  }
  return null;
}
`;

if (!code.includes('callOpenAIServerFallback')) {
  code = code.replace("import express", helper + "\nimport express");
}

fs.writeFileSync('server.ts', code);
