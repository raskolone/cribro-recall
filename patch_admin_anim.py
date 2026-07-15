import re

with open('components/admin/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Import gsap
code = code.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport gsap from 'gsap';")

hook_str = """
  // Render content based on active tab"""

anim_code = """
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [activeTab]);

  // Render content based on active tab"""

code = code.replace(hook_str, anim_code)

old_render = """  return (
    <div className="space-y-6">"""
new_render = """  return (
    <div className="space-y-6">"""
    
old_render_content = """        <div className="bg-base-200/50 backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]">
          {renderContent()}
        </div>"""
new_render_content = """        <div ref={containerRef} className="bg-base-200/50 backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]">
          {renderContent()}
        </div>"""

code = code.replace(old_render_content, new_render_content)

with open('components/admin/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched AdminPanel")
