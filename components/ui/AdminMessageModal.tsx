import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Button from './Button';

const AdminMessageModal: React.FC = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (user?.adminMessage) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [user?.adminMessage]);

  const handleDismiss = async () => {
    if (!user || !user.id || !user.adminMessage) return;
    setIsDismissing(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { adminMessage: null });
      setIsVisible(false);
    } catch (e) {
      console.error("Failed to dismiss admin message", e);
    } finally {
      setIsDismissing(false);
    }
  };

  if (!isVisible || !user?.adminMessage) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-base-200 border border-primary/30 w-full max-w-lg rounded-3xl p-6 shadow-[0_16px_64px_rgba(0,0,0,0.6)] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          
          <button 
            onClick={handleDismiss}
            disabled={isDismissing}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-start gap-4 relative z-10">
            <div className="p-3 rounded-2xl bg-primary/20 text-primary shrink-0 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]">
              <MessageSquare size={28} />
            </div>
            
            <div className="flex-1 min-w-0 pr-8">
              <h3 className="text-xl font-bold text-white mb-1">
                {user.adminMessage.title || 'Wiadomość od nauczyciela'}
              </h3>
              <p className="text-xs text-primary/70 font-mono mb-4">
                {new Date(user.adminMessage.createdAt).toLocaleString('pl-PL')}
              </p>
              
              <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                {user.adminMessage.text}
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={handleDismiss} 
                  isLoading={isDismissing}
                  className="bg-primary text-black font-bold px-8 shadow-lg shadow-primary/20 hover:shadow-primary/40"
                >
                  Zrozumiałem
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AdminMessageModal;
