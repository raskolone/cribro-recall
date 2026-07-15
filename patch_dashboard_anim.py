with open('components/dashboard/Dashboard.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add import gsap
code = code.replace("import React, { useState, useEffect, useMemo } from 'react';", "import React, { useState, useEffect, useMemo, useRef } from 'react';\nimport gsap from 'gsap';")

# Add ref and useEffect
hook_str = """
  const [checkedSets, setCheckedSets] = useState<string[]>"""

anim_code = """
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(contentRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [view, practiceView, activeSetId, adminSelectedUserId]);

  const [checkedSets, setCheckedSets] = useState<string[]>"""

code = code.replace(hook_str, anim_code)

# Wrap renderContent
old_render = "{renderContent()}"
new_render = "<div ref={contentRef} className=\"w-full h-full\">\n          {renderContent()}\n        </div>"

code = code.replace(old_render, new_render)

with open('components/dashboard/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched Dashboard")
