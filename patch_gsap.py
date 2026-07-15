import re

with open('components/admin/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add new refs
content = re.sub(
    r"const tabContentRef = useRef<HTMLDivElement>\(null\);\n\s*const userListRef = useRef<HTMLDivElement>\(null\);",
    "const tabContentRef = useRef<HTMLDivElement>(null);\n  const userListRef = useRef<HTMLDivElement>(null);\n  const profileContainerRef = useRef<HTMLDivElement>(null);\n  const mainMenuRef = useRef<HTMLDivElement>(null);",
    content
)

# Replace useEffects
old_use_effects = """  useEffect(() => {
    if (tabContentRef.current) {
      gsap.fromTo(tabContentRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [activeTab]);

  useEffect(() => {
    if (userListRef.current && !selectedUser) {
      const elements = userListRef.current.children;
      Array.from(elements).forEach((el, index) => {
        gsap.fromTo(el,
          { opacity: 0, x: index % 2 === 0 ? -100 : 100 },
          { opacity: 1, x: 0, duration: 0.6, ease: "power3.out", delay: index * 0.05, clearProps: "all" }
        );
      });
    }
  }, [activeTab, selectedUser]);"""

new_use_effects = """  useEffect(() => {
    if (tabContentRef.current && selectedUser) {
      gsap.fromTo(tabContentRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "all" }
      );
    }
  }, [activeTab, selectedUser]);

  useEffect(() => {
    if (userListRef.current && !selectedUser) {
      gsap.fromTo(userListRef.current.children,
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.3, ease: "power2.out", stagger: 0.04, clearProps: "all" }
      );
    }
  }, [activeTab, selectedUser]);

  useEffect(() => {
    if (profileContainerRef.current && selectedUser) {
      gsap.fromTo(profileContainerRef.current,
        { opacity: 0, scale: 0.98, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "all" }
      );
    }
  }, [selectedUser]);

  useEffect(() => {
    if (mainMenuRef.current && activeTab === null) {
      gsap.fromTo(mainMenuRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", stagger: 0.04, clearProps: "all" }
      );
    }
  }, [activeTab]);"""

content = content.replace(old_use_effects, new_use_effects)

# Apply mainMenuRef
content = content.replace('{activeTab === null ? (\n        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">', '{activeTab === null ? (\n        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" ref={mainMenuRef}>')

# Apply profileContainerRef
content = content.replace(') : (\n            <div>\n              <div className="mb-4 flex items-center gap-6">', ') : (\n            <div ref={profileContainerRef}>\n              <div className="mb-4 flex items-center gap-6">')

# Apply tabContentRef
# We need to wrap the contents after <div className="mb-6 flex items-center gap-4"> ... </div>
# We can do this by searching for {activeTab === 'stats' && (
content = content.replace("{activeTab === 'stats' && (", "<div ref={tabContentRef}>\n          {activeTab === 'stats' && (")

# And we must close it before the last </div> before )}
# Let's find the end of the selectedUser block.
with open('components/admin/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("done")
