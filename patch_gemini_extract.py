import re

with open('services/geminiService.ts', 'r') as f:
    content = f.read()

# Replace JSON.parse logic to handle object wrapping
old_parse = "return JSON.parse(jsonText);"
new_parse = """
    let parsed = JSON.parse(jsonText);
    if (parsed && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.cards)) return parsed.cards;
      if (Array.isArray(parsed.flashcards)) return parsed.flashcards;
      if (Array.isArray(parsed.vocabulary)) return parsed.vocabulary;
      if (Array.isArray(parsed.items)) return parsed.items;
      return [];
    }
    return parsed;
"""

if old_parse in content:
    content = content.replace(old_parse, new_parse)
else:
    print("Could not find old parse.")

with open('services/geminiService.ts', 'w') as f:
    f.write(content)
