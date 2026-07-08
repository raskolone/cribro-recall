import { evaluateTranslations } from './services/geminiService';

async function run() {
  const ex = [
    { polishSentence: "Pojechałem do domu i zamówiłem jedzenie na wynos, ponieważ byłem zmęczony.", englishTranslation: "I went home and ordered takeout because I was tired." }
  ];
  const ans = ["I went home, ordered some takeout because I was tired"];
  try {
    const res = await evaluateTranslations(ex, ans);
    console.log("Success:", res);
  } catch(e: any) {
    console.error("Failed:", e.message);
  }
}
run();
