import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "import { generateFlashcardsFromText, formatFlashcardsWithAI, generateContextSentence, generateImageForTerm } from '../../services/geminiService';",
    "import { generateFlashcardsFromText, generateFlashcardsFromTextWithGPT, formatFlashcardsWithAI, generateContextSentence, generateImageForTerm } from '../../services/geminiService';"
)

# 2. Update top bar (remove Zapisz i Cwicz)
old_top_bar = """          <Button variant="secondary" onClick={async () => { await handleManualSave(); onBack(); }}>
            {language === 'pl' ? 'Zapisz' : 'Save'}
          </Button>
          <Button onClick={async () => {
            await handleManualSave();
            onStudy(setId);
          }}>
            {language === 'pl' ? 'Zapisz i Ćwicz' : 'Save & Study'}
          </Button>"""

new_top_bar = """          <Button onClick={async () => { await handleManualSave(); onBack(); }} className="bg-amber-500 text-black hover:bg-amber-400 border-transparent">
            {language === 'pl' ? 'Zapisz nowy zestaw' : 'Save new set'}
          </Button>"""

# If there's an older layout
old_top_bar2 = """          <Button variant="secondary" onClick={async () => { await handleManualSave(); onBack(); }}>
            {language === 'pl' ? 'Zapisz' : 'Save'}
          </Button>"""

if "Zapisz i Ćwicz" in content:
    content = re.sub(r'<Button variant="secondary".*?>\s*\{language === \'pl\' \? \'Zapisz\' : \'Save\'\}\s*</Button>\s*<Button.*?>\s*\{language === \'pl\' \? \'Zapisz i Ćwicz\' : \'Save & Study\'\}\s*</Button>', new_top_bar, content, flags=re.DOTALL)
else:
    # We might have already removed it or it's different.
    # Let's just find the Save button.
    pass

# 3. Update handleGenerateFromTopic
old_handle_topic = """  const handleGenerateFromTopic = async () => {
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
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek z tego tematu.' : 'Failed to generate vocabulary for this topic.');
      }
    } catch (err: any) {
      alert(language === 'pl' ? 'Wystąpił błąd podczas generowania: ' + err.message : 'Error generating topic: ' + err.message);
      console.error(err);
    } finally {
      setIsGeneratingAITopic(false);
    }
  };"""

new_handle_topic = """  const handleGenerateFromTopic = async (cleanSet: boolean) => {
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
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek z tego tematu.' : 'Failed to generate vocabulary for this topic.');
      }
    } catch (err: any) {
      alert(language === 'pl' ? 'Wystąpił błąd podczas generowania: ' + err.message : 'Error generating topic: ' + err.message);
      console.error(err);
    } finally {
      setIsGeneratingAITopic(false);
    }
  };"""

content = content.replace(old_handle_topic, new_handle_topic)

# 4. Update handleImportWithAI
old_handle_import = """  const handleImportWithAI = async () => {
    if (!importText.trim()) return;
    setIsImportingWithAI(true);
    try {
      const generatedCards = await generateFlashcardsFromText(importText, importTermLang, importDefLang);
      if (generatedCards && generatedCards.length > 0) {
        const newCards: Partial<Flashcard>[] = generatedCards.map((c, idx) => ({
          id: `card-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          term: c.term,
          definition: c.definition,
          contextSentence: c.contextSentence,
          termLanguage: importTermLang,
          definitionLanguage: importDefLang,
          isLocked: false
        }));
        setCards(prev => [...prev, ...newCards]);
        setIsImportModalOpen(false);
        setImportText('');
      } else {
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek z tego tekstu.' : 'Failed to generate vocabulary from this text.');
      }
    } catch (err: any) {
      alert(language === 'pl' ? 'Wystąpił błąd podczas importu z AI: ' + err.message : 'Error during AI import: ' + err.message);
      console.error(err);
      
    } finally {
      setIsImportingWithAI(false);
    }
  };"""

new_handle_import = """  const handleImportWithAI = async (cleanSet: boolean) => {
    if (!importText.trim()) return;
    setIsImportingWithAI(true);
    try {
      const generatedCards = await generateFlashcardsFromTextWithGPT(importText, importTermLang, importDefLang);
      if (generatedCards && generatedCards.length > 0) {
        const newCards: Partial<Flashcard>[] = generatedCards.map((c, idx) => ({
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
        
        setIsImportModalOpen(false);
        setImportText('');
      } else {
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek z tego tekstu.' : 'Failed to generate vocabulary from this text.');
      }
    } catch (err: any) {
      alert(language === 'pl' ? 'Wystąpił błąd podczas importu z AI: ' + err.message : 'Error during AI import: ' + err.message);
      console.error(err);
      
    } finally {
      setIsImportingWithAI(false);
    }
  };"""
content = content.replace(old_handle_import, new_handle_import)

# 5. Update Topic Modal Buttons
old_topic_buttons = """            <div className="flex justify-end gap-3 mt-8">
              <Button variant="secondary" onClick={() => setIsAIGenModalOpen(false)}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleGenerateFromTopic} 
                disabled={!aiGenTopic.trim() || isGeneratingAITopic}
                className="bg-amber-500 text-black hover:bg-amber-400 border-transparent"
              >
                {isGeneratingAITopic ? (language === 'pl' ? 'Generowanie...' : 'Generating...') : (language === 'pl' ? 'Generuj ✨' : 'Generate ✨')}
              </Button>
            </div>"""

new_topic_buttons = """            <div className="flex justify-end gap-3 mt-8">
              <Button variant="secondary" onClick={() => setIsAIGenModalOpen(false)}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button 
                onClick={() => handleGenerateFromTopic(false)} 
                disabled={!aiGenTopic.trim() || isGeneratingAITopic}
                className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-transparent"
              >
                {isGeneratingAITopic ? '...' : (language === 'pl' ? 'Dodaj do istniejących ✨' : 'Append ✨')}
              </Button>
              <Button 
                onClick={() => handleGenerateFromTopic(true)} 
                disabled={!aiGenTopic.trim() || isGeneratingAITopic}
                className="bg-amber-500 text-black hover:bg-amber-400 border-transparent"
              >
                {isGeneratingAITopic ? (language === 'pl' ? 'Generowanie...' : 'Generating...') : (language === 'pl' ? 'Czysty Zestaw ✨' : 'Clean Set ✨')}
              </Button>
            </div>"""
content = content.replace(old_topic_buttons, new_topic_buttons)


# 6. Update Import Modal Buttons
old_import_buttons = """            <div className="flex justify-end gap-3 mt-8">
              <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleImportWithAI} 
                disabled={!importText.trim() || isImportingWithAI}
                className="bg-amber-500 text-black hover:bg-amber-400 border-transparent"
              >
                {isImportingWithAI ? (language === 'pl' ? 'Analizowanie...' : 'Analyzing...') : (language === 'pl' ? 'Generuj z AI ✨' : 'Generate with AI ✨')}
              </Button>
            </div>"""

new_import_buttons = """            <div className="flex justify-end gap-3 mt-8">
              <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>
                {language === 'pl' ? 'Anuluj' : 'Cancel'}
              </Button>
              <Button 
                onClick={() => handleImportWithAI(false)} 
                disabled={!importText.trim() || isImportingWithAI}
                className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-transparent"
              >
                {isImportingWithAI ? '...' : (language === 'pl' ? 'Dodaj do istniejących ✨' : 'Append ✨')}
              </Button>
              <Button 
                onClick={() => handleImportWithAI(true)} 
                disabled={!importText.trim() || isImportingWithAI}
                className="bg-amber-500 text-black hover:bg-amber-400 border-transparent"
              >
                {isImportingWithAI ? (language === 'pl' ? 'Analizowanie...' : 'Analyzing...') : (language === 'pl' ? 'Czysty Zestaw ✨' : 'Clean Set ✨')}
              </Button>
            </div>"""
content = content.replace(old_import_buttons, new_import_buttons)


with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)
