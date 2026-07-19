import { generateTranslationExercises } from './services/geminiService';
async function test() {
  const start = Date.now();
  console.log("Starting...");
  try {
    const res = await generateTranslationExercises("B1", [], "", "", "", 5, "");
    console.log("Done in " + (Date.now() - start) + "ms");
    console.log(res.length + " sentences generated.");
  } catch (e) {
    console.error(e);
  }
}
test();
