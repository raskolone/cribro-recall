import { generateTranslationExercises } from './services/geminiService';
async function test() {
  console.log("Starting...");
  try {
    const res = await generateTranslationExercises("B1", [], "", "", "", 5, "");
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
test();
