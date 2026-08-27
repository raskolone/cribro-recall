import React, { useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Zakończ',
  cancelText = 'Anuluj',
  onConfirm,
  onCancel
}) => {
  useEscapeModal(isOpen, onCancel, 10); // Higher priority since confirm modals are top overlays

  useEffect(() => {
    const handleCloseModal = () => {
      if (isOpen) onCancel();
    };
    window.addEventListener('close-modal', handleCloseModal);
    return () => window.removeEventListener('close-modal', handleCloseModal);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <Card className="w-full max-w-md p-6 bg-base-100 border border-white/10 shadow-2xl animate-fade-in-up">
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-content-muted mb-6">{message}</p>
        
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant="danger" onClick={onConfirm} className="bg-danger/20 text-danger hover:bg-danger/30 border border-danger/50">
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ConfirmModal;
