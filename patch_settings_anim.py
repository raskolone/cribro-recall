import re

with open('components/settings/SettingsScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Import gsap
code = code.replace("import React, { useState } from 'react';", "import React, { useState, useRef, useEffect } from 'react';\nimport gsap from 'gsap';")

hook_str = """
  const handleSaveAIConfig = async () => {"""

anim_code = """
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current.children, 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [activeTab]);

  const handleSaveAIConfig = async () => {"""

code = code.replace(hook_str, anim_code)

old_render = """      {/* Content Area */}
      <div className="bg-base-200/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6 md:p-8 min-h-[500px]">"""
new_render = """      {/* Content Area */}
      <div ref={containerRef} className="bg-base-200/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6 md:p-8 min-h-[500px]">"""

code = code.replace(old_render, new_render)

with open('components/settings/SettingsScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched SettingsScreen")
