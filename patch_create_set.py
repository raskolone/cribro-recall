import re

with open('components/flashcards/FlashcardSetsScreen.tsx', 'r') as f:
    content = f.read()

content = content.replace("isPublic: false", "isPublic: false,\n        isDraft: true")

with open('components/flashcards/FlashcardSetsScreen.tsx', 'w') as f:
    f.write(content)
