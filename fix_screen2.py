import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

old_func = """  const handleGenerateFromTopic = async () => {
    if (!aiGenTopic.trim()) return;
    setIsGeneratingAITopic(true);
    try {
      // @ts-ignore
      const { generateFlashcardsFromTopicWithGPT } = await import('../../services/geminiService');
      const generatedCards = await generateFlashcardsFromTopicWithGPT(aiGenTopic, aiGenCount, importTermLang, importDefLang);
      if (generatedCards && generatedCards.length > 0) {
        const newCards: Partial<Flashcard>[] = generatedCards.map((c: any, idx: number) => ({
          id: `card-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          term: c.term,
          definition: c.definition,
          contextSentence: c.contextSentence,
          termLanguage: importTermLang,
          definitionLanguage: importDefLang,
          isLocked: false
        }));
        setCards(prev => [...prev, ...newCards]);
        setIsAIGenModalOpen(false);
        setAiGenTopic('');
      } else {
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek.' : 'Failed to generate vocabulary.');
      }
    } catch (err: any) {
      console.error(err);
      alert(language === 'pl' ? 'Błąd podczas generowania: ' + err.message : 'Error generating: ' + err.message);
    } finally {
      setIsGeneratingAITopic(false);
    }
  };"""

new_func = """  const handleGenerateFromTopic = async (cleanSet: boolean) => {
    if (!aiGenTopic.trim()) return;
    setIsGeneratingAITopic(true);
    try {
      // @ts-ignore
      const { generateFlashcardsFromTopicWithGPT } = await import('../../services/geminiService');
      const generatedCards = await generateFlashcardsFromTopicWithGPT(aiGenTopic, aiGenCount, importTermLang, importDefLang);
      if (generatedCards && generatedCards.length > 0) {
        const newCards: Partial<Flashcard>[] = generatedCards.map((c: any, idx: number) => ({
          id: `card-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          term: c.term,
          definition: c.definition,
          contextSentence: c.contextSentence,
          termLanguage: importTermLang,
          definitionLanguage: importDefLang,
          isLocked: false
        }));
        
        if (cleanSet) {
            setCards(newCards as Flashcard[]);
        } else {
            setCards(prev => [...prev, ...newCards]);
        }
        
        setIsAIGenModalOpen(false);
        setAiGenTopic('');
      } else {
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek.' : 'Failed to generate vocabulary.');
      }
    } catch (err: any) {
      console.error(err);
      alert(language === 'pl' ? 'Błąd podczas generowania: ' + err.message : 'Error generating: ' + err.message);
    } finally {
      setIsGeneratingAITopic(false);
    }
  };"""

if old_func in content:
    content = content.replace(old_func, new_func)
else:
    print("WARNING: Could not find handleGenerateFromTopic to replace")

with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)
