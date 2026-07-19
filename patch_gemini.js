import fs from 'fs';
let content = fs.readFileSync('services/geminiService.ts', 'utf-8');

// Replace the nested try-catch blocks with a simpler one for generateTranslationExercises
const genTarget = `    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    } catch (e1: any) {
      console.warn("gemini-3.5-flash failed, falling back to gemini-3.5-flash", e1);
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: finalPrompt,
          config,
        });
      } catch (e2: any) {
        console.warn("gemini-3.5-flash failed, falling back to gemini-3.5-flash", e2);
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: finalPrompt,
            config,
          });
        } catch (e3: any) {
          console.warn("gemini-3.5-flash failed, falling back to gemini-3.5-flash", e3);
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: finalPrompt,
            config,
          });
        }
      }
    }`;

const genReplacement = `    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    } catch (e1: any) {
      console.warn("gemini-3.5-flash failed on first attempt, retrying once...", e1);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    }`;
    
content = content.replace(genTarget, genReplacement);

// Do the same for evaluateTranslations
const evalTarget = `    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    } catch (e1: any) {
      console.warn("gemini-3.5-flash failed, falling back to gemini-3.5-flash", e1);
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: finalPrompt,
          config,
        });
      } catch (e2: any) {
        console.warn("gemini-3.5-flash failed again, falling back to gemini-3.5-flash", e2);
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: finalPrompt,
            config,
          });
        } catch (e3: any) {
           console.warn("gemini-3.5-flash failed, falling back to gemini-3.5-flash", e3);
           response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: finalPrompt,
            config,
          });
        }
      }
    }`;

const evalReplacement = `    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    } catch (e1: any) {
      console.warn("gemini-3.5-flash eval failed on first attempt, retrying once...", e1);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config,
      });
    }`;

content = content.replace(evalTarget, evalReplacement);

fs.writeFileSync('services/geminiService.ts', content);
