import React from 'react';
import { Mail, AlertTriangle, Send, X } from 'lucide-react';
import Button from '../ui/Button';

interface SendConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recipient: string;
  subject: string;
  bodySnippet: string;
  isSending: boolean;
}

export const SendConfirmationModal: React.FC<SendConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  recipient,
  subject,
  bodySnippet,
  isSending
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div 
        className="relative w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Potwierdzenie wysłania wiadomości</h3>
              <p className="text-xs text-content-muted">Twoja wiadomość zostanie wysłana z Twojego konta Gmail</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSending}
            className="text-content-muted hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col gap-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-content-muted text-xs font-semibold uppercase tracking-wider w-20">Odbiorca:</span>
            <span className="font-bold text-primary truncate">{recipient}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-content-muted text-xs font-semibold uppercase tracking-wider w-20">Temat:</span>
            <span className="font-medium text-white truncate">{subject || '(Brak tematu)'}</span>
          </div>
          <div className="pt-2 border-t border-white/5">
            <span className="text-content-muted text-xs font-semibold uppercase tracking-wider block mb-1.5">Podgląd treści:</span>
            <div className="text-xs text-content-muted line-clamp-4 bg-black/20 p-2.5 rounded-lg font-mono whitespace-pre-wrap">
              {bodySnippet || '(Brak treści)'}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <span>Wiadomość trafi bezpośrednio do skrzynki odbiorcy i nie będzie można cofnąć jej wysłania.</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSending}
            className="text-content-muted hover:text-white"
          >
            Anuluj
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            isLoading={isSending}
            className="bg-primary hover:bg-primary-hover text-black font-bold flex items-center gap-2 shadow-glow"
          >
            <Send size={16} />
            <span>Potwierdź i wyślij</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
