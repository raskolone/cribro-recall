import re
with open('components/flashcards/FlashcardSetsScreen.tsx', 'r') as f:
    content = f.read()

old_code = """              <Button 
                onClick={() => {
                  deleteSet(setToDelete);
                  setSetToDelete(null);
                }}"""
new_code = """              <Button 
                onClick={() => {
                  if (setToDelete) {
                    deleteSet(setToDelete);
                  }
                  setSetToDelete(null);
                }}"""
content = content.replace(old_code, new_code)
with open('components/flashcards/FlashcardSetsScreen.tsx', 'w') as f:
    f.write(content)
