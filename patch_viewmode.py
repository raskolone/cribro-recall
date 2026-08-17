import re

with open('components/flashcards/FlashcardSetsScreen.tsx', 'r') as f:
    content = f.read()

# Replace rendering maps
lessons_map_old = "{lessonSets.map((set, idx) => renderLessonSetRow(set, idx))}"
lessons_map_new = "{lessonSets.map((set, idx) => renderLessonSet(set, idx, viewMode))}"
if lessons_map_old in content:
    content = content.replace(lessons_map_old, lessons_map_new)
else:
    print("lessons_map_old not found")

other_map_old = "{otherSets.map(renderOtherSetCard)}"
other_map_new = "{otherSets.map(set => renderOtherSet(set, viewMode))}"
if other_map_old in content:
    content = content.replace(other_map_old, other_map_new)
else:
    print("other_map_old not found")
    
# Change the grid layout class conditionally
other_grid_old = '<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">'
other_grid_new = '<div className={viewMode === \'grid\' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>'
content = content.replace(other_grid_old, other_grid_new)

lesson_grid_old = '<div className="flex flex-col gap-3">'
lesson_grid_new = '<div className={viewMode === \'grid\' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>'
content = content.replace(lesson_grid_old, lesson_grid_new)

# We will need to replace the functions entirely. It's better to just write a new script for replacing functions.
with open('components/flashcards/FlashcardSetsScreen.tsx', 'w') as f:
    f.write(content)
