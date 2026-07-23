const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const retryFunction = `
async function generateContentWithRetry(aiClient, contents, config) {
  const models = ['gemini-3.5-flash', 'gemini-3.5-flash-8b', 'gemini-3.1-pro', 'gemini-3.1-flash-lite'];
  let lastError;
  
  for (const model of models) {
    let retries = 3;
    while (retries > 0) {
      try {
        console.log(\`[Server] Attempting generation with \${model}... (retries left: \${retries})\`);
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timed out after 45 seconds")), 45000);
        });
        
        const apiCall = aiClient.models.generateContent({
          model,
          contents,
          config
        });
        
        const response = await Promise.race([apiCall, timeoutPromise]);
        return response;
      } catch (err) {
        console.warn(\`[Server] Model \${model} failed:\`, err?.status || err?.message);
        lastError = err;
        
        if (err?.message?.includes("timed out") || err?.status === 503 || err?.status === 429) {
          retries--;
          if (retries > 0) {
            console.log(\`[Server] Waiting before retry...\`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
        } else if (err?.status === 404 || (err?.status === 400 && err?.message?.includes("not found"))) {
          break; // Next model
        } else {
          throw err;
        }
      }
    }
  }
  throw lastError;
}
`;

content = content.replace(/import \{ GoogleGenAI, Type, Modality \} from '@google\/genai';/, `import { GoogleGenAI, Type, Modality } from '@google/genai';\n${retryFunction}`);

// Now replace usages in server.ts
// 1. generate-test
let genTestRegex = /let response;\n\s*try \{\n\s*response = await ai\.models\.generateContent\(\{\n\s*model: 'gemini-3\.5-flash',\n\s*contents: contents,\n\s*config: \{\n\s*responseMimeType: 'application\/json',\n\s*responseSchema: schema,\n\s*temperature: 0\.4\n\s*\}\n\s*\}\);\n\s*\} catch \(err\) \{\n[\s\S]*?\}\n/;

let genTestReplace = `      let response = await generateContentWithRetry(ai, contents, {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.4
      });
`;
content = content.replace(genTestRegex, genTestReplace);

// 2. parse-lesson-bulk
let parseBulkRegex = /let response;\n\s*try \{\n\s*response = await ai\.models\.generateContent\(\{\n\s*model: 'gemini-3\.5-flash',\n\s*contents: contents,\n\s*config: \{\n\s*systemInstruction: sysInstruction,\n\s*responseMimeType: "application\/json",\n\s*responseSchema: \{[\s\S]*?\}\n\s*\}\n\s*\}\);\n\s*\} catch \(err\) \{\n[\s\S]*?\}\n/;

let parseBulkReplace = `      const schema = {
        type: Type.OBJECT,
        properties: {
          lessons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                studentId: { type: Type.STRING },
                lessonTopic: { type: Type.STRING },
                revisionNotes: { type: Type.STRING },
                vocabularyText: { type: Type.STRING },
                studentSpeaking: { type: Type.STRING },
                thingsToImprove: { type: Type.STRING },
                suggestedFollowUp: { type: Type.STRING },
              },
              required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText"]
            }
          }
        },
        required: ["lessons"]
      };
      
      let response = await generateContentWithRetry(ai, contents, {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      });
`;
content = content.replace(parseBulkRegex, parseBulkReplace);

// 3. parse-lesson
let parseSingleRegex = /let response;\n\s*try \{\n\s*response = await ai\.models\.generateContent\(\{\n\s*model: 'gemini-3\.5-flash',\n\s*contents: promptContext,\n\s*config: \{\n\s*systemInstruction: sysInstruction,\n\s*responseMimeType: "application\/json",\n\s*responseSchema: \{[\s\S]*?\}\n\s*\}\n\s*\}\);\n\s*\} catch\(err\) \{\n[\s\S]*?\}\n/;

let parseSingleReplace = `      const schema = {
        type: Type.OBJECT,
        properties: {
          studentId: { type: Type.STRING },
          lessonTopic: { type: Type.STRING },
          revisionNotes: { type: Type.STRING },
          vocabularyText: { type: Type.STRING },
          studentSpeaking: { type: Type.STRING },
          thingsToImprove: { type: Type.STRING },
          suggestedFollowUp: { type: Type.STRING },
        },
        required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText", "studentSpeaking", "thingsToImprove", "suggestedFollowUp"]
      };

      let response = await generateContentWithRetry(ai, promptContext, {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      });
`;
content = content.replace(parseSingleRegex, parseSingleReplace);

// 4. evaluate-test
let evalTestRegex = /const response = await ai\.models\.generateContent\(\{\n\s*model: 'gemini-3\.5-flash',\n\s*contents: prompt,\n\s*config: \{\n\s*responseMimeType: 'application\/json',\n\s*responseSchema: \{[\s\S]*?\}\n\s*\}\n\s*\}\);/;

let evalTestReplace = `      const response = await generateContentWithRetry(ai, prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING }
          },
          required: ["score", "feedback"]
        }
      });`;
content = content.replace(evalTestRegex, evalTestReplace);

fs.writeFileSync(file, content);
