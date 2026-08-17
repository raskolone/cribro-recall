import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

# remove onBack() from handleManualSave
content = content.replace("await updateSet(setId, { title, description, isPublic, isDraft: false });\n      onBack();", "await updateSet(setId, { title, description, isPublic, isDraft: false });")

# add onBack() to first button onClick
content = content.replace('onClick={handleManualSave}', 'onClick={async () => { await handleManualSave(); onBack(); }}')

# modify labels
content = content.replace("{language === 'pl' ? 'Stwórz' : 'Create'}", "{language === 'pl' ? 'Zakończ i Zapisz' : 'Finish & Save'}")
content = content.replace("{language === 'pl' ? 'Stwórz i ćwicz' : 'Create and Study'}", "{language === 'pl' ? 'Zakończ i Ćwicz' : 'Finish & Study'}")

with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)

