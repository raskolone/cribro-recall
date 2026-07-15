import re

with open('components/flashcards/FlashcardStudyScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

if "import gsap from 'gsap';" not in code:
    code = code.replace("import React, { useState, useEffect, useMemo } from 'react';", "import React, { useState, useEffect, useMemo, useRef } from 'react';\nimport gsap from 'gsap';")

hook_str = """
  // Set mastery based on learning history"""

anim_code = """
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, 
        { opacity: 0, scale: 0.98 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [mode]);

  // Set mastery based on learning history"""

if "const containerRef =" not in code:
    code = code.replace(hook_str, anim_code)

old_render = "      <div className=\"flex flex-col items-center justify-center min-h-[400px] bg-base-200/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]\">"
new_render = "      <div ref={containerRef} className=\"flex flex-col items-center justify-center min-h-[400px] bg-base-200/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]\">"

code = code.replace(old_render, new_render)

old_render2 = "        <div className=\"w-full max-w-4xl mx-auto flex-1 flex flex-col\">"
new_render2 = "        <div ref={containerRef} className=\"w-full max-w-4xl mx-auto flex-1 flex flex-col\">"

code = code.replace(old_render2, new_render2)


with open('components/flashcards/FlashcardStudyScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched FlashcardStudyScreen")
