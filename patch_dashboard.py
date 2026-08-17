import re

with open('components/dashboard/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add a navigateTo wrapper and useEffect for popstate
new_hooks = """  const [activeSetId, setActiveSetId] = useState<string | null>(null);

  // Handle browser back button
  useEffect(() => {
    window.history.replaceState({ view, activeSetId }, '');
    
    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        if (e.state.view) setView(e.state.view);
        if (e.state.activeSetId !== undefined) setActiveSetId(e.state.activeSetId);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (newView: View, extra?: any) => {
    let newSetId = activeSetId;
    if (extra && (extra.setId || extra.activeSetId)) {
      newSetId = extra.setId || extra.activeSetId;
    } else if (newView === 'dashboard' || newView === 'flashcard-sets' || newView === 'topic-database') {
      newSetId = null;
    }
    
    if (newView !== view || newSetId !== activeSetId) {
      window.history.pushState({ view: newView, activeSetId: newSetId }, '');
      setView(newView);
      setActiveSetId(newSetId);
    }
  };
"""

content = content.replace("  const [activeSetId, setActiveSetId] = useState<string | null>(null);", new_hooks)

# Now replace setView(newView) and onNavigate with handleNavigate
content = content.replace("setView('dashboard')", "handleNavigate('dashboard')")
content = content.replace("setView('flashcard-sets')", "handleNavigate('flashcard-sets')")
content = content.replace("setView('student-stats')", "handleNavigate('student-stats')")
content = content.replace("setView('flashcard-study')", "handleNavigate('flashcard-study')")
content = content.replace("setView('flashcard-edit')", "handleNavigate('flashcard-edit')")
content = content.replace("setView('flashcard-stats')", "handleNavigate('flashcard-stats')")
content = content.replace("setView('presentation')", "handleNavigate('presentation')")

content = content.replace("onNavigate={(newView) => setView(newView)}", "onNavigate={(newView) => handleNavigate(newView)}")
content = content.replace("onNavigate={setView}", "onNavigate={handleNavigate}")

# For complex onNavigate implementations:
complex_nav = """          onNavigate={(v: any, extra?: any) => {
            if (extra && (extra.setId || extra.activeSetId)) {
              setActiveSetId(extra.setId || extra.activeSetId);
            }
            setView(v);
          }}"""
content = content.replace(complex_nav, "          onNavigate={handleNavigate}")

complex_nav2 = """         onNavigate={(v: any, extra?: any) => {
          if (extra && (extra.setId || extra.activeSetId)) setActiveSetId(extra.setId || extra.activeSetId);
          if (extra && extra.initialMode) {
            (window as any)._initialStudyMode = extra.initialMode;
          }
          setView(v);
        }}"""
complex_nav2_replacement = """         onNavigate={(v: any, extra?: any) => {
          if (extra && extra.initialMode) {
            (window as any)._initialStudyMode = extra.initialMode;
          }
          handleNavigate(v, extra);
        }}"""
content = content.replace(complex_nav2, complex_nav2_replacement)


complex_nav3 = """        onNavigate={(v: any, extra?: any) => {
          if (extra && (extra.setId || extra.activeSetId)) setActiveSetId(extra.setId || extra.activeSetId);
          setView(v);
        }}"""
content = content.replace(complex_nav3, "        onNavigate={handleNavigate}")

# Update setView references inside the render tree if any missed:
content = content.replace("onClick={() => setView(", "onClick={() => handleNavigate(")

with open('components/dashboard/Dashboard.tsx', 'w') as f:
    f.write(content)
