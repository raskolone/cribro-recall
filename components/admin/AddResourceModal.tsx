import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getAI } from '../../services/geminiService';

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddResourceModal: React.FC<AddResourceModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    setError(null);

    try {
      const ai = getAI();
      const prompt = `Jesteś asystentem nauczyciela angielskiego. Otrzymasz surowy tekst (słownictwo, idiomy lub czasowniki złożone).
Twoim zadaniem jest sformatowanie ich do ujednoliconego formatu JSON.
Rozpoznaj typ materiału:
1. vocabulary (zwykłe słówka i zwroty)
2. idiom (idiomy angielskie)
3. phrasal (czasowniki złożone - phrasal verbs)

Zwróć poprawny JSON w formacie:
{
  "type": "vocabulary" | "idiom" | "phrasal",
  "name": "Tytuł wygenerowany na podstawie zawartości (tylko dla vocabulary, np. 'Jedzenie', 'Biznes')",
  "items": [
    // Jeśli type="vocabulary":
    { "english": "apple", "polish": "jabłko" }
    
    // Jeśli type="idiom":
    { "english": "piece of cake", "polish": "bułka z masłem", "example": "The test was a piece of cake.", "category": "General" }
    
    // Jeśli type="phrasal":
    { "verb": "give up", "polish": "poddać się", "definition": "to stop trying to do something", "example": "Never give up.", "level": "B1" }
  ]
}

Pamiętaj o zamknięciu JSONa. Zwróć tylko czysty kod JSON, żadnych znaczników markdown.

Tekst od nauczyciela:
${rawText}`;

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      let parsed = JSON.parse(result.text || "{}");
      
      // Save to Firebase based on type
      if (parsed.type === 'vocabulary') {
         const newSet = {
           title: parsed.name || 'Nowy zestaw',
           createdBy: 'teacher',
           createdAt: new Date().toISOString(),
           isUniversal: true,
           studentId: 'universal'
         };
         const docRef = await addDoc(collection(db, 'sets'), newSet);
         
         const batch = [];
         for (const item of parsed.items) {
           await addDoc(collection(db, `sets/${docRef.id}/flashcards`), {
             term: item.english,
             definition: item.polish,
             createdAt: new Date().toISOString()
           });
         }
      } else if (parsed.type === 'idiom') {
         for (const item of parsed.items) {
           await addDoc(collection(db, 'global_idioms'), {
             ...item,
             createdAt: new Date().toISOString()
           });
         }
      } else if (parsed.type === 'phrasal') {
         for (const item of parsed.items) {
           await addDoc(collection(db, 'global_phrasals'), {
             ...item,
             createdAt: new Date().toISOString()
           });
         }
      } else {
         throw new Error("Nieznany typ materiału z AI.");
      }

      onSuccess();
      setRawText('');
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Wystąpił błąd podczas analizy przez AI. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#121824] border border-white/10 w-full max-w-2xl rounded-3xl p-6 shadow-2xl relative overflow-hidden"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
                <Sparkles size={24} />
              </div>
              <h2 className="text-2xl font-bold text-white">Dodaj nowe zasoby</h2>
            </div>
            
            <p className="text-sm text-gray-300 mb-6">
              Wklej tutaj słówka, idiomy lub phrasal verbs z dowolnego źródła. Sztuczna inteligencja automatycznie je sformatuje, podzieli na kategorie i doda do odpowiedniej bazy dla wszystkich kursantów.
            </p>
            
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Np. break down - zepsuć się, piece of cake - bułka z masłem, jabłko - apple..."
              className="w-full h-48 bg-black/30 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none resize-none mb-6 custom-scrollbar"
              disabled={isProcessing}
            />
            
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
                Anuluj
              </Button>
              <Button onClick={handleProcess} isLoading={isProcessing} className="bg-primary text-black font-bold">
                {isProcessing ? 'Porządkowanie (AI)...' : 'Dodaj zasoby'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddResourceModal;
