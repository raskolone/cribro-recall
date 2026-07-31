const fs = require('fs');
let code = fs.readFileSync('components/ui/AdminMessageModal.tsx', 'utf8');

const targetUseEffect = `  useEffect(() => {
    if (user?.adminMessage) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [user?.adminMessage]);`;
const newUseEffect = `  useEffect(() => {
    if (user?.adminMessage) {
      try {
        const dismissed = JSON.parse(localStorage.getItem('dismissed_admin_messages') || '[]');
        if (dismissed.includes(user.adminMessage.createdAt)) {
          setIsVisible(false);
          return;
        }
      } catch(e) {}
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [user?.adminMessage]);`;
code = code.replace(targetUseEffect, newUseEffect);

const targetHandleDismiss = `  const handleDismiss = async () => {
    if (!user || !user.id || !user.adminMessage) return;
    setIsDismissing(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { adminMessage: deleteField() });
      setIsVisible(false);
    } catch (e) {
      console.error("Failed to dismiss admin message", e);
    } finally {
      setIsDismissing(false);
    }
  };`;
const newHandleDismiss = `  const handleDismiss = async () => {
    if (!user || !user.id || !user.adminMessage) return;
    setIsDismissing(true);
    
    // Save locally immediately to prevent re-showing
    try {
      const dismissed = JSON.parse(localStorage.getItem('dismissed_admin_messages') || '[]');
      dismissed.push(user.adminMessage.createdAt);
      localStorage.setItem('dismissed_admin_messages', JSON.stringify(dismissed));
    } catch(e) {}
    
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { adminMessage: deleteField() });
      setIsVisible(false);
    } catch (e) {
      console.error("Failed to dismiss admin message", e);
    } finally {
      setIsDismissing(false);
    }
  };`;
code = code.replace(targetHandleDismiss, newHandleDismiss);

fs.writeFileSync('components/ui/AdminMessageModal.tsx', code);
