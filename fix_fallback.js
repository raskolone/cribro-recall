import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /catch \(e1: any\) \{\s*console\.warn\("gemini-3\.5-flash failed, retrying with gemini-3\.5-flash\.\.\.", e1\);\s*response = await ai\.models\.generateContent\(\{\s*model: "gemini-3\.5-flash",/g,
  `catch (e1: any) {
      console.warn("gemini-3.5-flash failed, retrying with gemini-3.1-flash-lite...", e1);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",`
);

content = content.replace(
  /catch \(e1\) \{\s*response = await ai\.models\.generateContent\(\{\s*model: "gemini-3\.5-flash",/g,
  `catch (e1) {
      console.warn("gemini-3.5-flash eval failed, retrying with gemini-3.1-flash-lite...", e1);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",`
);

fs.writeFileSync(file, content);
console.log("Fixed fallbacks");
