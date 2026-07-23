import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
const dict = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));

async function translateKeys() {
    const enDict: Record<string, string> = {};
    const plDict: Record<string, string> = {};
    
    // Batch processing
    const batchSize = 50;
    for (let i = 0; i < dict.length; i += batchSize) {
        const batch = dict.slice(i, i + batchSize);
        console.log(`Translating batch ${i} to ${i + batchSize}...`);
        
        const prompt = `Translate the following Polish UI strings to English. Return ONLY a valid JSON object mapping the exact original Polish string to the English translation.\n\nOriginal Strings:\n${JSON.stringify(batch)}`;
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
                config: {
                   responseMimeType: 'application/json'
                }
            });
            const text = response.text;
            if (text) {
                const translations = JSON.parse(text);
                for (const key of batch) {
                    enDict[key] = translations[key] || key; // fallback
                    plDict[key] = key; // identity map
                }
            }
        } catch (e) {
            console.error(`Error on batch ${i}:`, e);
            // fallback
            for (const key of batch) {
                enDict[key] = key;
                plDict[key] = key;
            }
        }
    }
    
    fs.writeFileSync('en.json', JSON.stringify(enDict, null, 2));
    fs.writeFileSync('pl.json', JSON.stringify(plDict, null, 2));
    console.log('Translations saved.');
}

translateKeys().catch(console.error);
