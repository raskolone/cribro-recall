import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, Sparkles, X, XCircle } from 'lucide-react';
import { AlertModalOptions, AlertTone, hideAppAlert, subscribeAppAlert } from '../../utils/appAlert';
import Button from './Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';

export const AppAlertModal: React.FC = () => {
  const [alertData, setAlertData] = useState<AlertModalOptions | null>(null);

  useEffect(() => {
    return subscribeAppAlert((data) => {
      setAlertData(data);
      if (data) {
        playSubtleChime(data.tone || 'info');
      }
    });
  }, []);

  useEscapeModal(Boolean(alertData), () => {
    handleClose();
  }, 100);

  // Play subtle sound based on alert tone
  const playSubtleChime = (tone: AlertTone) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (tone === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
      } else if (tone === 'warn' || tone === 'danger') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.18); // E4
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      }

      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch {
      // Audio autoplay might be disabled in browser
    }
  };

  const handleClose = () => {
    if (alertData?.onClose) {
      try {
        alertData.onClose();
      } catch (e) {
        console.error(e);
      }
    }
    hideAppAlert();
  };

  const handleConfirm = () => {
    if (alertData?.onConfirm) {
      try {
        alertData.onConfirm();
      } catch (e) {
        console.error(e);
      }
    }
    handleClose();
  };

  const handleCancel = () => {
    if (alertData?.onCancel) {
      try {
        alertData.onCancel();
      } catch (e) {
        console.error(e);
      }
    }
    handleClose();
  };

  if (!alertData) return null;

  const tone: AlertTone = alertData.tone || 'info';

  const toneConfig: Record<
    AlertTone,
    {
      borderColor: string;
      glowColor: string;
      iconBg: string;
      icon: React.ReactNode;
      badgeStyle: string;
      badgeLabel: string;
    }
  > = {
    success: {
      borderColor: 'border-primary/40',
      glowColor: 'bg-primary/20',
      iconBg: 'bg-gradient-to-br from-primary/30 to-primary/10 text-primary border border-primary/35 shadow-[0_0_25px_rgba(114,240,180,0.35)]',
      icon: <CheckCircle2 size={32} />,
      badgeStyle: 'bg-primary/20 text-primary border border-primary/30',
      badgeLabel: 'Sukces',
    },
    warn: {
      borderColor: 'border-warn/45',
      glowColor: 'bg-warn/20',
      iconBg: 'bg-gradient-to-br from-warn/30 to-warn/10 text-warn border border-warn/35 shadow-[0_0_25px_rgba(234,179,8,0.35)]',
      icon: <AlertTriangle size={32} />,
      badgeStyle: 'bg-warn/20 text-warn border border-warn/30',
      badgeLabel: 'Uwaga',
    },
    danger: {
      borderColor: 'border-danger/45',
      glowColor: 'bg-danger/20',
      iconBg: 'bg-gradient-to-br from-danger/30 to-danger/10 text-danger border border-danger/35 shadow-[0_0_25px_rgba(239,68,68,0.35)]',
      icon: <XCircle size={32} />,
      badgeStyle: 'bg-danger/20 text-danger border border-danger/30',
      badgeLabel: 'Komunikat',
    },
    info: {
      borderColor: 'border-primary/30',
      glowColor: 'bg-primary/15',
      iconBg: 'bg-gradient-to-br from-primary/25 to-primary/10 text-primary border border-primary/30 shadow-[0_0_25px_rgba(114,240,180,0.25)]',
      icon: <Sparkles size={32} />,
      badgeStyle: 'bg-primary/15 text-primary border border-primary/25',
      badgeLabel: 'Informacja',
    },
  };

  const cfg = toneConfig[tone];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 380 }}
          className={`w-full max-w-md bg-base-200 border ${cfg.borderColor} rounded-3xl p-6 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.85)] relative overflow-hidden text-center`}
        >
          {/* Ambient neon light */}
          <div
            className={`absolute -top-16 -right-16 w-48 h-48 ${cfg.glowColor} rounded-full blur-3xl pointer-events-none`}
          />
          <div
            className={`absolute -bottom-16 -left-16 w-48 h-48 ${cfg.glowColor} rounded-full blur-3xl pointer-events-none`}
          />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white transition-colors"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>

          <div className="relative z-10 space-y-4">
            {/* Tone Icon */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${cfg.iconBg}`}>
              {cfg.icon}
            </div>

            {/* Badge & Title */}
            <div>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[12px] font-bold uppercase tracking-wider mb-1.5 ${cfg.badgeStyle}`}
              >
                {cfg.badgeLabel}
              </span>
              <h3 className="text-xl font-extrabold text-white leading-tight">
                {alertData.title}
              </h3>
              <p className="text-[14px] text-content-muted leading-relaxed mt-2.5 whitespace-pre-line text-balance">
                {alertData.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {alertData.isConfirm ? (
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleCancel}
                    className="flex-1 py-3 text-sm rounded-xl font-semibold"
                  >
                    {alertData.cancelText || 'Anuluj'}
                  </Button>
                  <Button
                    variant={tone === 'danger' ? 'danger' : 'primary'}
                    onClick={handleConfirm}
                    className={`flex-1 py-3 text-sm rounded-xl font-bold ${
                      tone === 'danger'
                        ? 'bg-danger hover:bg-danger/90 text-white'
                        : 'bg-primary hover:bg-primary/90 text-accent-ink'
                    }`}
                  >
                    {alertData.buttonText || 'Potwierdzam'}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleClose}
                  className="w-full py-3.5 text-sm rounded-xl bg-primary text-accent-ink font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-98 transition-all"
                >
                  {alertData.buttonText || 'Rozumiem'}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AppAlertModal;
