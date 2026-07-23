import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bug, X, AlertCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import i18n from "i18next";

interface BugReporterProps {
  errorContext?: string;
  onCloseError?: () => void;
}

const BugReporter: React.FC<BugReporterProps> = ({ errorContext, onCloseError }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(!!errorContext);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (errorContext) {
      setIsOpen(true);
      setDescription(`Wykryto błąd:\n${errorContext}\n\nOto co robiłem/am, gdy wystąpił błąd:\n`);
    }
  }, [errorContext]);

  if (!user || user.role !== 'user') {
    // Only student role ("user") can see this.
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'bug_reports'), {
        userId: user.id || user.username,
        userEmail: user.email,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        userRole: user.role,
        description: description,
        errorContext: errorContext || null,
        path: window.location.pathname,
        status: 'new',
        createdAt: serverTimestamp()
      });
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setDescription('');
        if (onCloseError) onCloseError();
      }, 3000);
    } catch (error) {
      console.error("Failed to submit bug report:", error);
      alert("Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg flex items-center justify-center transition-all transform hover:scale-110"
        title={i18n.t("Zgłoś problem")}
      >
        <Bug size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 glass-panel rounded-2xl shadow-2xl overflow-hidden border border-red-500/30 animate-in slide-in-from-bottom-5">
      <div className="bg-red-500/10 p-4 border-b border-white/10 flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2 text-red-400">
          <AlertCircle size={18} />
          
                            {i18n.t("Zgłoś problem")}
                          </h3>
        <button 
          onClick={() => {
            setIsOpen(false);
            if (onCloseError) onCloseError();
          }}
          className="text-content-muted hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      {submitted ? (
        <div className="p-6 text-center text-green-400 font-medium">
          
                            {i18n.t("Dziękujemy! Twoje zgłoszenie zostało wysłane.")}
                          </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 space-y-4 bg-black/40">
          <p className="text-sm text-content-muted">
            
                                      {i18n.t("Coś nie działa poprawnie? Opisz nam co się stało, abyśmy mogli to naprawić.")}
                                    </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={i18n.t("Opisz problem... (np. Przycisk X nie reaguje po kliknięciu)")}
            className="w-full h-32 p-3 bg-black/50 border border-white/10 rounded-xl text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none placeholder:text-white/20"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting || !description.trim()}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 text-white py-2.5 rounded-xl font-medium transition-colors"
          >
            {isSubmitting ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
          </button>
        </form>
      )}
    </div>
  );
};

export default BugReporter;
