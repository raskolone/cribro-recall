with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

old_if = """        setIsImportModalOpen(false);
        setImportText('');
      }
    } catch (err) {"""

new_if = """        setIsImportModalOpen(false);
        setImportText('');
      } else {
        alert(language === 'pl' ? 'Nie udało się wygenerować słówek z tego tekstu.' : 'Failed to generate vocabulary from this text.');
      }
    } catch (err: any) {
      alert(language === 'pl' ? 'Wystąpił błąd podczas importu z AI: ' + err.message : 'Error during AI import: ' + err.message);"""

if old_if in content:
    content = content.replace(old_if, new_if)
    
# also replace the console.error block if it exists
content = content.replace("alert('Failed to import with AI. Check your API Key.');", "")

with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)
