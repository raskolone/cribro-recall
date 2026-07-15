import re

with open('components/landing/LandingPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Check if gsap is imported
if "import gsap from 'gsap';" not in code:
    code = code.replace("import React, { useState } from 'react';", "import React, { useState, useRef, useEffect } from 'react';\nimport gsap from 'gsap';")

hook_str = """
  return ("""

anim_code = """
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current.children, 
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out', clearProps: 'all' }
      );
    }
  }, []);

  return ("""

if "const containerRef =" not in code:
    code = code.replace(hook_str, anim_code)

old_render = "      <div className=\"flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8 py-12 md:py-20 relative z-10\">"
new_render = "      <div ref={containerRef} className=\"flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8 py-12 md:py-20 relative z-10\">"

code = code.replace(old_render, new_render)

with open('components/landing/LandingPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched LandingPage")
