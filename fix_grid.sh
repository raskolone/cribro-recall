#!/bin/bash
# Remove lines 155 to 249
sed -i '155,249d' components/flashcards/FlashcardStudyScreen.tsx

# Replace onBack={() => setSelectedMode(null)} with onBack={onBack}
sed -i 's/onBack={() => setSelectedMode(null)}/onBack={onBack}/g' components/flashcards/FlashcardStudyScreen.tsx

# Update FlashcardsMode to pass onNavigate and language
sed -i 's/saveSession={saveSession}/saveSession={saveSession}\n        onNavigate={onNavigate}\n        language={language}/g' components/flashcards/FlashcardStudyScreen.tsx

