import re

with open('components/flashcards/FlashcardSetsScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Import gsap
code = code.replace("import React, { useState, useMemo, useEffect } from 'react';", "import React, { useState, useMemo, useEffect, useRef } from 'react';\nimport gsap from 'gsap';")

# Add ref for container and animate
hook_str = """
  const handleCreateNewSet = async () => {"""

anim_code = """
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current.children, 
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [sets]);

  const handleCreateNewSet = async () => {"""

code = code.replace(hook_str, anim_code)

old_render = "<div className=\"space-y-8 max-w-6xl mx-auto pb-12\">"
new_render = "<div className=\"space-y-8 max-w-6xl mx-auto pb-12\" ref={containerRef}>"

code = code.replace(old_render, new_render)

with open('components/flashcards/FlashcardSetsScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched FlashcardSetsScreen")
