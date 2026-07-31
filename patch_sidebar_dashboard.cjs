const fs = require('fs');

// Patch Sidebar.tsx
let sidebarCode = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');

const targetHandleNavigate = `  const handleNavigate = (view: any) => {
    onNavigate(view);
    onClose();
  };`;
const newHandleNavigate = `  const handleNavigate = (view: any) => {
    if (view === 'flashcard-sets' && user?.hasNewVocabulary) {
      if (user?.id) {
        updateDoc(doc(db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error);
      }
    }
    if (view === 'lesson-history' && user?.hasNewLesson) {
      if (user?.id) {
        updateDoc(doc(db, 'users', user.id), { hasNewLesson: false }).catch(console.error);
      }
    }
    onNavigate(view);
    onClose();
  };`;
sidebarCode = sidebarCode.replace(targetHandleNavigate, newHandleNavigate);

fs.writeFileSync('components/dashboard/Sidebar.tsx', sidebarCode);

// Patch Dashboard.tsx
let dashboardCode = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');

const targetHeader = `<header className="p-4 bg-base-100 border-b border-white/10 flex items-center gap-4">`;
const newHeader = `<header className="p-4 bg-base-100 border-b border-white/10 flex items-center gap-4 overflow-hidden">`;
dashboardCode = dashboardCode.replace(targetHeader, newHeader);

const targetSloganInterval = `const interval = setInterval(animateSlogan, 15000); // Change slogan every 15 seconds`;
const newSloganInterval = `const interval = setInterval(animateSlogan, 10000); // Change slogan every 10 seconds`;
dashboardCode = dashboardCode.replace(targetSloganInterval, newSloganInterval);

const targetGsap = `        gsap.fromTo(sloganContainerRef.current,
          { opacity: 0, x: 50 },
          { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' }
        );`;
const newGsap = `        gsap.fromTo(sloganContainerRef.current,
          { opacity: 0, x: window.innerWidth },
          { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' }
        );`;
dashboardCode = dashboardCode.replace(targetGsap, newGsap);

fs.writeFileSync('components/dashboard/Dashboard.tsx', dashboardCode);

