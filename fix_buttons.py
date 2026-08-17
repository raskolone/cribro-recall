import re

with open('components/flashcards/FlashcardEditScreen.tsx', 'r') as f:
    content = f.read()

# Fix Generate from Topic buttons
topic_buttons_search = r'<Button\s+onClick=\{handleGenerateFromTopic\}\s+disabled=\{\!aiGenTopic\.trim\(\) \|\| isGeneratingAITopic\}\s+className="bg-amber-500 text-black hover:bg-amber-400"\s*>\s*\{isGeneratingAITopic \? \(language === \'pl\' \? \'Generowanie\.\.\.\' : \'Generating\.\.\.\'\) : \(language === \'pl\' \? \'Generuj ✨\' : \'Generate ✨\'\)\}\s*</Button>'

topic_buttons_replace = """<Button 
                onClick={() => handleGenerateFromTopic(false)} 
                disabled={!aiGenTopic.trim() || isGeneratingAITopic}
                className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
              >
                {isGeneratingAITopic ? '...' : (language === 'pl' ? 'Dodaj do istniejących ✨' : 'Append ✨')}
              </Button>
              <Button 
                onClick={() => handleGenerateFromTopic(true)} 
                disabled={!aiGenTopic.trim() || isGeneratingAITopic}
                className="bg-amber-500 text-black hover:bg-amber-400"
              >
                {isGeneratingAITopic ? (language === 'pl' ? 'Generowanie...' : 'Generating...') : (language === 'pl' ? 'Czysty Zestaw ✨' : 'Clean Set ✨')}
              </Button>"""

content = re.sub(topic_buttons_search, topic_buttons_replace, content, flags=re.DOTALL)

# Fix Import with AI buttons
# Actually, the user asked for this but maybe I missed it as well?
import_buttons_search = r'<Button\s+onClick=\{handleImportWithAI\}\s+disabled=\{\!importText\.trim\(\) \|\| isImportingWithAI\}\s+className="bg-amber-500 text-black hover:bg-amber-400 border-transparent"\s*>\s*\{isImportingWithAI \? \(language === \'pl\' \? \'Analizowanie\.\.\.\' : \'Analyzing\.\.\.\'\) : \(language === \'pl\' \? \'Generuj z AI ✨\' : \'Generate with AI ✨\'\)\}\s*</Button>'

import_buttons_replace = """<Button 
                onClick={() => handleImportWithAI(false)} 
                disabled={!importText.trim() || isImportingWithAI}
                className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-transparent"
              >
                {isImportingWithAI ? '...' : (language === 'pl' ? 'Dodaj do istniejących ✨' : 'Append ✨')}
              </Button>
              <Button 
                onClick={() => handleImportWithAI(true)} 
                disabled={!importText.trim() || isImportingWithAI}
                className="bg-amber-500 text-black hover:bg-amber-400 border-transparent"
              >
                {isImportingWithAI ? (language === 'pl' ? 'Analizowanie...' : 'Analyzing...') : (language === 'pl' ? 'Czysty Zestaw ✨' : 'Clean Set ✨')}
              </Button>"""

content = re.sub(import_buttons_search, import_buttons_replace, content, flags=re.DOTALL)


with open('components/flashcards/FlashcardEditScreen.tsx', 'w') as f:
    f.write(content)

