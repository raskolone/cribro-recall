import re

with open('components/auth/AuthScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

if "import gsap from 'gsap';" not in code:
    code = code.replace("import React, { useState } from 'react';", "import React, { useState, useRef, useEffect } from 'react';\nimport gsap from 'gsap';")

hook_str = """
  const [resetError, setResetError] = useState('');"""

anim_code = """
  const [resetError, setResetError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, 
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.5)', clearProps: 'all' }
      );
    }
  }, [isLogin]);"""

if "const containerRef =" not in code:
    code = code.replace(hook_str, anim_code)

old_render = "      <div className=\"max-w-md w-full mx-auto p-8 rounded-3xl bg-base-200/50 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] relative overflow-hidden\">"
new_render = "      <div ref={containerRef} className=\"max-w-md w-full mx-auto p-8 rounded-3xl bg-base-200/50 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] relative overflow-hidden\">"

code = code.replace(old_render, new_render)

with open('components/auth/AuthScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched AuthScreen")
