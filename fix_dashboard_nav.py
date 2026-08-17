import re

with open('components/dashboard/Dashboard.tsx', 'r') as f:
    content = f.read()

# Fix onStudySet
old_study = """          onStudySet={(setId) => {
            setActiveSetId(setId);
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study');
          }}"""
new_study = """          onStudySet={(setId) => {
            (window as any)._initialStudyMode = 'flashcards';
            handleNavigate('flashcard-study', { setId });
          }}"""
content = content.replace(old_study, new_study)

# Fix onEditSet
old_edit = """          onEditSet={(setId) => {
            setActiveSetId(setId);
            handleNavigate('flashcard-edit');
          }}"""
new_edit = """          onEditSet={(setId) => {
            handleNavigate('flashcard-edit', { setId });
          }}"""
content = content.replace(old_edit, new_edit)

# Fix onStatsSet
old_stats = """          onStatsSet={(setId) => {
            setActiveSetId(setId);
            handleNavigate('flashcard-stats');
          }}"""
new_stats = """          onStatsSet={(setId) => {
            handleNavigate('flashcard-stats', { setId });
          }}"""
content = content.replace(old_stats, new_stats)

# Fix onPresentSet
old_present = """          onPresentSet={(setId) => {
            setActiveSetId(setId);
            handleNavigate('presentation');
          }}"""
new_present = """          onPresentSet={(setId) => {
            handleNavigate('presentation', { setId });
          }}"""
content = content.replace(old_present, new_present)

with open('components/dashboard/Dashboard.tsx', 'w') as f:
    f.write(content)
