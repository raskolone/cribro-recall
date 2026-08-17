import re

with open('services/geminiService.ts', 'r') as f:
    content = f.read()

old_schema_code = """  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        term: { type: Type.STRING },
        definition: { type: Type.STRING },
        contextSentence: { type: Type.STRING }
      },
      required: ["term", "definition", "contextSentence"]
    }
  };

  try {
    const response = await generateContentWithFallback({ contents: prompt, config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      } });"""

new_schema_code = """  try {
    const response = await generateContentWithFallback({ contents: prompt, config: {
        responseMimeType: "application/json"
      } });"""

content = content.replace(old_schema_code, new_schema_code)

with open('services/geminiService.ts', 'w') as f:
    f.write(content)
