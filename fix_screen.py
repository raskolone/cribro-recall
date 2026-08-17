import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

# Fix handleGenerateFromTopic
old_topic = r"const handleGenerateFromTopic = async \(\) => \{(.*?)\} catch \(err: any\) \{"
new_topic = r"""const handleGenerateFromTopic = async (cleanSet: boolean = false) => {\1
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
    } catch (err: any) {"""

# Let's just do a manual string replace to be safe.
