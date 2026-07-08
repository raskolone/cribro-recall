import { evaluateTranslations } from './services/geminiService';

async function run() {
  const ex = [
    { polishSentence: "Poszedłem do domu", englishTranslation: "I went home" }
  ];
  const ans = ["I went home"];
  try {
    const res = await evaluateTranslations(ex, ans);
    console.log("Success:", res);
  } catch(e: any) {
    console.error("Failed:", e.message);
  }
}
run();
