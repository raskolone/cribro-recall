import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// The helper is inserted successfully? Let's check.
const hasHelper = content.includes('generateContentWithFallback');
if (!hasHelper) {
    console.error("Helper not found!");
    process.exit(1);
}

// Replace the try/catch blocks that manually fallback with generateContentWithFallback.
// We have several variants because I wrote them in different ways earlier.

// Variant 1: generateTranslationExercises
content = content.replace(
  /let response;\s*try \{\s*response = await ai\.models\.generateContent\(\{\s*model: "[^"]+",\s*contents: (finalPrompt|prompt|l),\s*config,\s*\}\);\s*\} catch \(e1:? any\)? \{\s*console\.warn\("[^"]+", e1\);\s*response = await ai\.models\.generateContent\(\{\s*model: "[^"]+",\s*contents: (finalPrompt|prompt|l),\s*config,\s*\}\);\s*\}/g,
  `const response = await generateContentWithFallback({ contents: $1, config });`
);

// Variant 2: the others
content = content.replace(
  /let response;\s*try \{\s*response = await ai\.models\.generateContent\(\{\s*model: "[^"]+",\s*contents: (.*?),\s*config,\s*\}\);\s*\} catch \(e1\) \{\s*console\.warn\("[^"]+", e1\);\s*response = await ai\.models\.generateContent\(\{\s*model: "[^"]+",\s*contents: (.*?),\s*config,\s*\}\);\s*\}/g,
  `const response = await generateContentWithFallback({ contents: $1, config });`
);

// Variant 3: straight generateContent calls without the inner try-catch fallback
content = content.replace(
  /const response = await ai\.models\.generateContent\(\{\s*model: "[^"]+",\s*contents: (.*?),\s*config:?(.*?)\s*\}\);/g,
  `const response = await generateContentWithFallback({ contents: $1, config: $2 });`
);

// Variant 4: where config is not passed as an explicit property but shorthand
content = content.replace(
  /const response = await ai\.models\.generateContent\(\{\s*model: "[^"]+",\s*contents: (.*?),\s*config,\s*\}\);/g,
  `const response = await generateContentWithFallback({ contents: $1, config });`
);

// Variant 5: no config
content = content.replace(
  /const response = await ai\.models\.generateContent\(\{\s*model: "[^"]+",\s*contents: (.*?),\s*\}\);/g,
  `const response = await generateContentWithFallback({ contents: $1 });`
);

// The getAudioPronunciation is a special case since it uses a TTS model.
content = content.replace(
  /const response = await generateContentWithFallback\(\{ contents: \[\{ parts: \[\{ text: text \}\] \}\], config: \{\s*responseModalities/g,
  `const response = await ai.models.generateContent({ model: "gemini-3.1-flash-tts-preview", contents: [{ parts: [{ text: text }] }], config: { responseModalities`
);

fs.writeFileSync(file, content);
console.log("Replaced calls");
