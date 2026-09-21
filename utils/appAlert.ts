// Centralized In-App Alert and Modal Notification System
// Replaces browser native window.alert() with styled, centered in-app modals.

export type AlertTone = 'success' | 'warn' | 'danger' | 'info';

export interface AlertModalOptions {
  title?: string;
  message: string;
  tone?: AlertTone;
  buttonText?: string;
  cancelText?: string;
  isConfirm?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

type AlertListener = (options: AlertModalOptions | null) => void;
const listeners = new Set<AlertListener>();

export const showAppAlert = (options: string | AlertModalOptions) => {
  const alertData: AlertModalOptions = typeof options === 'string'
    ? { message: options }
    : { ...options };

  // Infer tone and title if not explicitly provided
  if (!alertData.tone) {
    const msg = (alertData.message || '').toLowerCase();
    if (
      msg.includes('błąd') ||
      msg.includes('nie udało') ||
      msg.includes('failed') ||
      msg.includes('error') ||
      msg.includes('zaległ')
    ) {
      alertData.tone = 'danger';
      if (!alertData.title) alertData.title = 'Wystąpił problem';
    } else if (
      msg.includes('uwaga') ||
      msg.includes('wybierz') ||
      msg.includes('warning') ||
      msg.includes('termin minął') ||
      msg.includes('uzupełnij')
    ) {
      alertData.tone = 'warn';
      if (!alertData.title) alertData.title = 'Uwaga';
    } else if (
      msg.includes('sukces') ||
      msg.includes('pomyślnie') ||
      msg.includes('zapisano') ||
      msg.includes('przypisano') ||
      msg.includes('przeanalizowane') ||
      msg.includes('zaktualizowana') ||
      msg.includes('skopiowano')
    ) {
      alertData.tone = 'success';
      if (!alertData.title) alertData.title = 'Sukces';
    } else {
      alertData.tone = 'info';
      if (!alertData.title) alertData.title = 'Powiadomienie';
    }
  } else if (!alertData.title) {
    switch (alertData.tone) {
      case 'success':
        alertData.title = 'Sukces';
        break;
      case 'warn':
        alertData.title = 'Uwaga';
        break;
      case 'danger':
        alertData.title = 'Wystąpił problem';
        break;
      case 'info':
      default:
        alertData.title = 'Powiadomienie';
        break;
    }
  }

  listeners.forEach((listener) => {
    try {
      listener(alertData);
    } catch (e) {
      console.error('Error in alert listener:', e);
    }
  });
};

export const showAppConfirm = (
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  title: string = 'Wymagane potwierdzenie'
) => {
  showAppAlert({
    title,
    message,
    tone: 'warn',
    isConfirm: true,
    buttonText: 'Tak, potwierdzam',
    cancelText: 'Anuluj',
    onConfirm,
    onCancel,
  });
};

/**
 * Wersja `showAppConfirm` jako Promise — pozwala zastąpić
 * `if (window.confirm(msg)) { ... }` przez `if (await confirmAsync(msg)) { ... }`
 * bez przepisywania każdego wywołania na callbacki.
 */
export const confirmAsync = (
  message: string,
  options?: { title?: string; tone?: AlertTone; confirmText?: string; cancelText?: string }
): Promise<boolean> =>
  new Promise((resolve) => {
    showAppAlert({
      title: options?.title ?? 'Wymagane potwierdzenie',
      message,
      tone: options?.tone ?? 'danger',
      isConfirm: true,
      buttonText: options?.confirmText ?? 'Tak, potwierdzam',
      cancelText: options?.cancelText ?? 'Anuluj',
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });

export const hideAppAlert = () => {
  listeners.forEach((listener) => {
    try {
      listener(null);
    } catch (e) {
      console.error('Error in alert listener during hide:', e);
    }
  });
};

export const subscribeAppAlert = (listener: AlertListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Global interceptor: ensures all calls to alert() anywhere in the app
// show the beautiful centered in-app modal instead of the browser dialog.
if (typeof window !== 'undefined') {
  if (!(window as any).__originalAlert) {
    (window as any).__originalAlert = window.alert;
  }
  window.alert = (message?: any) => {
    showAppAlert(String(message ?? ''));
  };
}
