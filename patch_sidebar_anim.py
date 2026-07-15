import re

with open('components/dashboard/Sidebar.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

if "import gsap from 'gsap';" not in code:
    code = code.replace("import React from 'react';", "import React, { useRef, useEffect } from 'react';\nimport gsap from 'gsap';")

hook_str = """
  const { user, logout } = useAuth();"""

anim_code = """
  const { user, logout } = useAuth();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navRef.current) {
      gsap.fromTo(navRef.current.children, 
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, []);"""

if "const navRef =" not in code:
    code = code.replace(hook_str, anim_code)

old_render = "        <div className=\"flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar\">"
new_render = "        <div ref={navRef} className=\"flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar\">"

code = code.replace(old_render, new_render)

with open('components/dashboard/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched Sidebar")
