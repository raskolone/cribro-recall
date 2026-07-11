import { GoogleGenAI } from '@google/genai';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface SuggestionRequest {
  action: 'autocomplete' | 'define';
  term: string;
  source_language: string;
  target_language: string;
  context?: string;
}

export interface SuggestionResponse {
  suggestions?: string[];
  definition?: string;
  cached: boolean;
}

export const getAISuggestions = async (req: SuggestionRequest): Promise<SuggestionResponse> => {
  try {
    // 1. Check Cache
    const cacheRef = collection(db, 'aiSuggestionCache');
    const q = query(
      cacheRef,
      where('term', '==', req.term.toLowerCase()),
      where('sourceLanguage', '==', req.source_language),
      where('targetLanguage', '==', req.target_language)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const cachedData = snapshot.docs[0].data();
      if (req.action === 'define' && cachedData.suggestedDefinition) {
        return { definition: cachedData.suggestedDefinition, cached: true };
      }
      // For autocomplete, we might not cache lists in the same way, but let's keep it simple
    }

    // Helper to map code to name
    const getLangName = (code: string) => {
      const map: Record<string, string> = {
        pl: 'Polish', en: 'English', nl: 'Dutch', de: 'German', fr: 'French', 
        es: 'Spanish', it: 'Italian', pt: 'Portuguese', ru: 'Russian', 
        uk: 'Ukrainian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean'
      };
      return map[code] || code;
    };

    const sourceLangName = getLangName(req.source_language);
    const targetLangName = getLangName(req.target_language);

    // 2. Call Gemini API
    if (req.action === 'autocomplete') {
      const prompt = `You are a helpful language learning assistant. The user is creating a flashcard set titled "${req.context || 'Vocabulary'}". 
They have typed "${req.term}" in ${sourceLangName}. 
Provide up to 5 autocomplete suggestions or related terms in ${sourceLangName} that start with or are closely related to "${req.term}".
Return ONLY a JSON array of strings. No markdown formatting, no explanations.`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
        }
      });

      const text = response.text || '[]';
      try {
        const suggestions = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        return { suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [], cached: false };
      } catch (e) {
        console.error('Failed to parse autocomplete JSON', text);
        return { suggestions: [], cached: false };
      }
    } 
    
    if (req.action === 'define') {
      const prompt = `You are a helpful language learning assistant. The user is creating a flashcard set titled "${req.context || 'Vocabulary'}". 
Provide a clear, concise translation or definition for the term "${req.term}" from ${sourceLangName} to ${targetLangName}.
Return ONLY the translated term or short definition as a plain string. No quotes, no explanations.`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
        }
      });

      const definition = (response.text || '').trim();

      // Save to cache
      if (definition) {
        try {
          await addDoc(collection(db, 'aiSuggestionCache'), {
            term: req.term.toLowerCase(),
            sourceLanguage: req.source_language,
            targetLanguage: req.target_language,
            suggestedDefinition: definition,
            createdAt: serverTimestamp()
          });
        } catch (cacheError) {
          console.error('Failed to save to cache', cacheError);
        }
      }

      return { definition, cached: false };
    }

    return { cached: false };
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    throw error;
  }
};
