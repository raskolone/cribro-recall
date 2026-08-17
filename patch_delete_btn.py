import re

with open('components/flashcards/FlashcardSetsScreen.tsx', 'r') as f:
    content = f.read()

# Fix duplicated DRAFT badge
duplicate_draft = """              {cleanTitle}
                {set.isDraft && <span className="ml-2 text-[10px] uppercase bg-gray-500 text-white px-2 py-0.5 rounded-full">DRAFT</span>}
              {set.isDraft && <span className="ml-2 text-[10px] uppercase bg-gray-500 text-white px-2 py-0.5 rounded-full">DRAFT</span>}"""
fixed_draft = """              {cleanTitle}
              {set.isDraft && <span className="ml-2 text-[10px] uppercase bg-gray-500 text-white px-2 py-0.5 rounded-full">DRAFT</span>}"""
content = content.replace(duplicate_draft, fixed_draft)

# Add delete button to grid view
grid_btns_old = """            <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3">
              👀
            </Button>
          </div>"""
grid_btns_new = """            <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3" title={language === 'pl' ? 'Podgląd' : 'Preview'}>
              👀
            </Button>
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setSetToDelete(set.id); }} className="px-3 border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10" title={language === 'pl' ? 'Usuń zestaw' : 'Delete set'}>
              🗑️
            </Button>
          </div>"""
content = content.replace(grid_btns_old, grid_btns_new)

# Add delete button to list view
list_btns_old = """          <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3">
            👀
          </Button>
        </div>"""
list_btns_new = """          <Button variant="secondary" onClick={() => { markSetAsChecked(set.id); handlePreviewSet(set.id); }} disabled={set.cardCount === 0} className="px-3" title={language === 'pl' ? 'Podgląd' : 'Preview'}>
            👀
          </Button>
          <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setSetToDelete(set.id); }} className="px-3 border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10" title={language === 'pl' ? 'Usuń zestaw' : 'Delete set'}>
            🗑️
          </Button>
        </div>"""
content = content.replace(list_btns_old, list_btns_new)


with open('components/flashcards/FlashcardSetsScreen.tsx', 'w') as f:
    f.write(content)

