import OpenAI from "openai";

const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

if (!apiKey) {
  console.error("Brak VITE_DEEPSEEK_API_KEY!");
}

const deepseekClient = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: apiKey || '',
  dangerouslyAllowBrowser: true,
});

export const generateDeepSeekResponse = async (prompt: string, systemInstruction?: string) => {
  if (!apiKey) {
    console.error("Brak VITE_DEEPSEEK_API_KEY!");
    throw new Error("Brak klucza API DeepSeek.");
  }

  try {
    console.log("Wysyłam zapytanie do DeepSeek (deepseek-chat)...");
    
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const completion = await deepseekClient.chat.completions.create({
      messages,
      model: "deepseek-chat",
      response_format: { type: "json_object" },
    });

    return completion.choices[0].message.content;
  } catch (error) {
    if (error?.status === 402 || error?.message?.includes("402")) { console.warn("Brak środków na koncie DeepSeek (402). Przechodzę do modelu zapasowego..."); } else { console.warn("Błąd podczas komunikacji z DeepSeek API:", error?.message || error); }
    throw error;
  }
};
