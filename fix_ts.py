import re

with open('services/geminiService.ts', 'r') as f:
    content = f.read()

old_func = """    if (parsed && !Array.isArray(parsed)) {
      if (parsed.flashcards && Array.isArray(parsed.flashcards)) return parsed.flashcards;
      if (parsed.cards && Array.isArray(parsed.cards)) return parsed.cards;
      return [];
    }
    return parsed || [];"""

new_func = """    if (parsed && !Array.isArray(parsed)) {
      if ((parsed as any).flashcards && Array.isArray((parsed as any).flashcards)) return (parsed as any).flashcards;
      if ((parsed as any).cards && Array.isArray((parsed as any).cards)) return (parsed as any).cards;
      return [];
    }
    return (parsed as any) || [];"""

content = content.replace(old_func, new_func)

with open('services/geminiService.ts', 'w') as f:
    f.write(content)
