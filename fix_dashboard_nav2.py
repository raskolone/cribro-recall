import re

with open('components/dashboard/Dashboard.tsx', 'r') as f:
    content = f.read()

old_study_edit = """          onStudy={(setId) => {
            setActiveSetId(setId);
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study');
          }}"""
new_study_edit = """          onStudy={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }}"""
content = content.replace(old_study_edit, new_study_edit)

with open('components/dashboard/Dashboard.tsx', 'w') as f:
    f.write(content)
