with open('components/admin/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the start of useEffects
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if "  useEffect(() => {" in line and "if (tabContentRef.current) {" in lines[i+1]:
        start_idx = i
    if start_idx != -1 and "}, [selectedUser, searchQuery, roleFilter, users]);" in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
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
        { opacity: 1, x: 0, duration: 0.4, ease: "power2.out", stagger: 0.05, clearProps: "all" }
      );
    }
  }, [activeTab, selectedUser, searchQuery, roleFilter, users]);

  useEffect(() => {
    if (profileContainerRef.current && selectedUser) {
      gsap.fromTo(profileContainerRef.current,
        { opacity: 0, scale: 0.98, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "power2.out", clearProps: "all" }
      );
    }
  }, [selectedUser]);

  useEffect(() => {
    if (mainMenuRef.current && activeTab === null) {
      gsap.fromTo(mainMenuRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", stagger: 0.05, clearProps: "all" }
      );
    }
  }, [activeTab]);
"""
    del lines[start_idx:end_idx+1]
    lines.insert(start_idx, new_use_effects)

with open('components/admin/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("done")
