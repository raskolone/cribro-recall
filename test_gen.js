import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "dummy" });
console.log("Mock check completed");
