import re

with open('services/geminiService.ts', 'r') as f:
    content = f.read()

old_func = """export const generateFlashcardsFromTextWithGPT = async (text: string, termLang: string, defLang: string): Promise<any[]> => {
  const prompt = `Analyze the following text and extract vocabulary words/phrases from it.
Text: ${text}
Source language of terms: ${termLang}
Target language for definitions: ${defLang}

For each term found, provide:
1. The term itself.
2. A clear definition or translation in the target language.
3. An example context sentence in the source language (no translation needed).

Return a JSON array of objects.`;

  const sysInst = "You are an AI assistant creating flashcard sets in JSON format for the gpt-4o-mini model. Output ONLY a valid JSON array of objects with keys: term, definition, contextSentence.";

  try {
    const openAiRes = await callOpenAI(prompt, sysInst, 'gpt-4o-mini', true);
    
    let parsed = openAiRes;
    if (typeof openAiRes === 'string') {
        const jsonText = extractJSON(openAiRes);
        parsed = JSON.parse(jsonText);
    }
    
    if (parsed && !Array.isArray(parsed)) {
      if ((parsed as any).flashcards && Array.isArray((parsed as any).flashcards)) return (parsed as any).flashcards;
      if ((parsed as any).cards && Array.isArray((parsed as any).cards)) return (parsed as any).cards;
      return [];
    }
    return (parsed as any) || [];
  } catch (err) {
    console.error("Error generating flashcards from text with GPT:", err);
    throw new Error("Failed to parse vocabulary from text using GPT-4o-mini.");
  }
};"""

new_func = """export const generateFlashcardsFromTextWithGPT = async (text: string, termLang: string, defLang: string): Promise<any[]> => {
  const prompt = `Analyze the following text and extract vocabulary words/phrases from it.
Text: ${text}
Source language of terms: ${termLang}
Target language for definitions: ${defLang}

For each term found, provide:
1. The term itself.
2. A clear definition or translation in the target language.
3. An example context sentence in the source language (no translation needed).

Return a JSON array of objects.`;

  const sysInst = "You are an AI assistant creating flashcard sets in JSON format for the gpt-4o-mini model. Output ONLY a valid JSON array of objects with keys: term, definition, contextSentence.";

  try {
    const openAiRes = await callOpenAI(prompt, sysInst, 'gpt-4o-mini', true);
    const jsonText = extractJSON(openAiRes.text || "");
    const parsed = JSON.parse(jsonText);
    const list = Array.isArray(parsed) ? parsed : (parsed.flashcards || parsed.cards || parsed.words || parsed.items || []);
    return list;
  } catch (err) {
    console.error("Error generating flashcards from text with GPT:", err);
    throw new Error("Failed to parse vocabulary from text using GPT-4o-mini.");
  }
};"""

if old_func in content:
    content = content.replace(old_func, new_func)
else:
    print("WARNING: Could not find old_func in geminiService.ts")

with open('services/geminiService.ts', 'w') as f:
    f.write(content)
