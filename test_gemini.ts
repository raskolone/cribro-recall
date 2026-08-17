import { generateFlashcardsFromTextWithGPT, generateFlashcardsFromTopicWithGPT } from './services/geminiService';

async function test() {
  try {
      const topicCards = await generateFlashcardsFromTopicWithGPT("Cats", 2, "en", "pl");
      console.log("Topic cards:", topicCards);
  } catch(e) {
      console.error("Topic Error:", e);
  }

  try {
      const textCards = await generateFlashcardsFromTextWithGPT("I love dogs. Dogs are great.", "en", "pl");
      console.log("Text cards:", textCards);
  } catch(e) {
      console.error("Text Error:", e);
  }
}
test();
